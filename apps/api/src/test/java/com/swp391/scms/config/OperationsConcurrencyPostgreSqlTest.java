package com.swp391.scms.config;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Bộ kiểm thử đồng thời và biên gói thành viên trên PostgreSQL.
 * SCRUM-75: Kiểm thử xử lý đồng thời và ranh giới hiệu lực gói thành viên trên schema test Supabase biệt lập.
 */
@SpringBootTest
@ActiveProfiles("supabase")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class OperationsConcurrencyPostgreSqlTest {
    private static final String SCHEMA = "operations_test_" + UUID.randomUUID().toString().replace("-", "");

    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired CenterCheckinService checkins;
    @Autowired CenterCheckinRepository visits;
    @Autowired MembershipSubscriptionRepository subscriptions;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired Clock clock;
    @Autowired EnrollmentService bookingService;
    @Autowired com.swp391.scms.operations.service.StaffInternalRequestService internalRequests;
    @Autowired com.swp391.scms.operations.repository.StaffInternalRequestRepository internalRequestRepository;
    @Autowired com.swp391.scms.membership.service.MembershipSubscriptionService membershipService;
    @Autowired com.swp391.scms.membership.service.DynamicQrService dynamicQrService;
    private static final AtomicInteger BOOKING_DAY = new AtomicInteger(60);

    private ExecutorService workers;
    private AuthenticatedPrincipal staff;

    /** Hai đơn khác nhau cùng nhân viên: khóa nhân viên bảo vệ cả khi tập APPROVED ban đầu rỗng. */
    @Test
    void concurrentLeaveApprovalsCannotApproveOverlappingRequests() throws Exception {
        long owner = user("RECEPTIONIST"), manager = user("CENTER_MANAGER");
        LocalDate start = LocalDate.now(clock.withZone(com.swp391.scms.common.CenterTime.ZONE)).plusDays(10);
        var firstRequest = internalRequests.createRequest(owner, new com.swp391.scms.operations.dto.StaffInternalRequestCreateDto(
                "LEAVE", "Leave one", "Fixture", start, start.plusDays(1), null, null, false));
        var secondRequest = internalRequests.createRequest(owner, new com.swp391.scms.operations.dto.StaffInternalRequestCreateDto(
                "LEAVE", "Leave two", "Fixture", start, start.plusDays(1), null, null, true));
        var review = new com.swp391.scms.operations.dto.StaffInternalRequestReviewDto("APPROVED", "OK");
        assertFalse(internalRequestRepository.existsApprovedLeaveOn(owner, start), "Pending leave must not grant time off");
        var ready = new CountDownLatch(2);
        var firstPid = new AtomicInteger();
        var secondPid = new AtomicInteger();
        Future<?> first;
        Future<?> second;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select id from users where id = ? for update", owner);
                first = submit(ready, firstPid, () -> internalRequests.reviewRequest(manager, firstRequest.id(), review));
                second = submit(ready, secondPid, () -> internalRequests.reviewRequest(manager, secondRequest.id(), review));
                awaitBlocked(ready, firstPid, secondPid);
            } finally {
                blocker.rollback();
            }
        }
        int success = 0;
        for (Future<?> result : List.of(first, second)) {
            try {
                result.get(20, TimeUnit.SECONDS);
                success++;
            } catch (ExecutionException ex) {
                assertInstanceOf(com.swp391.scms.common.exception.ConflictException.class, ex.getCause());
            }
        }
        assertEquals(1, success);
        assertEquals(1, internalRequests.getMyRequests(owner, "APPROVED").size());
        assertEquals(1, internalRequests.getMyRequests(owner, "PENDING").size());
        assertTrue(internalRequestRepository.existsApprovedLeaveOn(owner, start));
        var another = internalRequests.createRequest(owner, new com.swp391.scms.operations.dto.StaffInternalRequestCreateDto(
                "LEAVE", "Another date", "Fixture", start.plusDays(10), start.plusDays(10), null, null));
        assertEquals("PENDING", another.status());
    }

    /** Hủy và duyệt cùng một đơn: chỉ một chuyển trạng thái được commit, không ghi đè kết quả. */
    @Test
    void concurrentLeaveReviewAndCancellationHaveOneWinner() throws Exception {
        long owner = user("RECEPTIONIST"), manager = user("CENTER_MANAGER");
        LocalDate start = LocalDate.now(clock.withZone(com.swp391.scms.common.CenterTime.ZONE)).plusDays(10);
        var request = internalRequests.createRequest(owner, new com.swp391.scms.operations.dto.StaffInternalRequestCreateDto(
                "LEAVE", "Leave", "Fixture", start, start, null, null));
        var ready = new CountDownLatch(2);
        var reviewPid = new AtomicInteger();
        var cancelPid = new AtomicInteger();
        Future<?> review;
        Future<?> cancel;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select id from staff_internal_requests where id = ? for update", request.id());
                review = submit(ready, reviewPid, () -> internalRequests.reviewRequest(manager, request.id(),
                        new com.swp391.scms.operations.dto.StaffInternalRequestReviewDto("APPROVED", "OK")));
                cancel = submit(ready, cancelPid, () -> internalRequests.cancelRequest(owner, request.id()));
                awaitBlocked(ready, reviewPid, cancelPid);
            } finally {
                blocker.rollback();
            }
        }
        int success = 0;
        for (Future<?> result : List.of(review, cancel)) {
            try {
                result.get(20, TimeUnit.SECONDS);
                success++;
            } catch (ExecutionException ex) {
                assertInstanceOf(BadRequestException.class, ex.getCause());
            }
        }
        assertEquals(1, success);
        assertEquals(0, internalRequests.getMyRequests(owner, "PENDING").size());
    }

    /** Hàm trợ giúp của test: lấy kết nối database test dùng chung. */
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) throws Exception {
        try (var connection = connectTestDatabase(); var statement = connection.createStatement()) {
            statement.execute("create schema \"" + SCHEMA + "\"");
        }
        properties.add("spring.datasource.url", () -> credential("SCMS_POSTGRES_TEST_URL"));
        properties.add("spring.datasource.username", () -> credential("SCMS_POSTGRES_TEST_USERNAME"));
        properties.add("spring.datasource.password", () -> credential("SCMS_POSTGRES_TEST_PASSWORD"));
        properties.add("spring.datasource.hikari.schema", () -> SCHEMA);
        properties.add("spring.datasource.hikari.maximum-pool-size", () -> 5);
        properties.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        properties.add("app.jwt.secret", () -> "c2Ntc19sb2NhbF9qd3Rfc2VjcmV0X2tleV9mb3Jfc3dwMzkxX3Byb2plY3RfMjAyNg==");
        properties.add("app.bootstrap.manager.email", () -> "operations-test@example.invalid");
        properties.add("app.bootstrap.manager.password", () -> "OperationsTest_75!");
        properties.add("app.auth.otp.delivery", () -> "disabled");
    }

    /** Dọn dẹp sau test: xóa schema của test đồng thời. */
    @AfterAll
    static void cleanupSchema() throws Exception {
        assertTrue(SCHEMA.matches("operations_test_[a-f0-9]{32}"));
        try (var connection = connectTestDatabase(); var statement = connection.createStatement()) {
            statement.execute("drop schema if exists \"" + SCHEMA + "\" cascade");
        }
    }

    /** Hàm trợ giúp của test: dựng các luồng worker và tài khoản nhân viên. */
    @BeforeEach
    void setupWorkersAndStaff() {
        workers = Executors.newFixedThreadPool(2);
        staff = new AuthenticatedPrincipal(user("CENTER_MANAGER"), "operations-test", "CENTER_MANAGER");
    }

    /** Hàm trợ giúp của test: dừng các luồng worker. */
    @AfterEach
    void stopWorkers() throws InterruptedException {
        workers.shutdownNow();
        assertTrue(workers.awaitTermination(20, TimeUnit.SECONDS), "Database workers must finish before schema cleanup");
    }

    /** Kiểm thử: nhiều QR khác nhau cùng lúc của một hội viên chỉ lưu một lượt cho vào và một lượt từ chối. */
    @Test
    void simultaneousDistinctQrsForOneMemberPersistOneGrantAndOneDenial() throws Exception {
        long member = member();
        String firstQr = subscription(member, "active", -1, 30);
        String secondQr = subscription(member, "active", -1, 30);
        var ready = new CountDownLatch(2);
        var firstPid = new AtomicInteger();
        var secondPid = new AtomicInteger();
        Future<CheckinDto> first;
        Future<CheckinDto> second;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select user_id from members where user_id = ? for update", member);
                first = submit(ready, firstPid, () -> scan(firstQr));
                second = submit(ready, secondPid, () -> scan(secondQr));
                awaitBlocked(ready, firstPid, secondPid);
            } finally {
                blocker.rollback();
            }
        }
        var results = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
        assertEquals(1, results.stream().filter(result -> "GRANTED".equals(result.status())).count());
        assertEquals(1, results.stream().filter(result -> "DENIED".equals(result.status())).count());
        assertEquals(2, countVisits(member, "true"));
        assertEquals(1, countVisits(member, "status = 'GRANTED' and check_out_time is null"));
        assertEquals(1, countVisits(member, "status = 'DENIED' and denial_reason = 'error.attendance.already_checked_in'"));
    }

    /** Kiểm thử: nhiều check-out cùng lúc chỉ có một người thắng và giữ nguyên thời điểm đã lưu. */
    @Test
    void simultaneousCheckoutsHaveOneWinnerAndPreserveItsTimestamp() throws Exception {
        long member = member();
        CheckinDto visit = scan(subscription(member, "active", -1, 30));
        LocalDateTime originalCheckin = timestamp(visit.id(), "check_in_time");
        var ready = new CountDownLatch(2);
        var firstPid = new AtomicInteger();
        var secondPid = new AtomicInteger();
        Future<CheckinDto> first;
        Future<CheckinDto> second;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select id from center_checkins where id = ? for update", visit.id());
                first = submit(ready, firstPid, () -> checkins.checkout(staff, visit.id()));
                second = submit(ready, secondPid, () -> checkins.checkout(staff, visit.id()));
                awaitBlocked(ready, firstPid, secondPid);
            } finally {
                blocker.rollback();
            }
        }
        CheckinDto firstResult = checkoutResult(first);
        CheckinDto secondResult = checkoutResult(second);
        assertTrue((firstResult == null) != (secondResult == null), "Exactly one checkout must fail with BadRequestException");
        CheckinDto winner = firstResult != null ? firstResult : secondResult;
        LocalDateTime storedCheckout = visits.findById(visit.id()).orElseThrow().getCheckOutTime();
        assertNotNull(winner.checkOutTime());
        // Kiểu timestamp của PostgreSQL làm tròn nano giây của Java xuống micro giây.
        assertTrue(Duration.between(winner.checkOutTime(), storedCheckout).abs().toNanos() <= 1_000);
        assertEquals(originalCheckin, timestamp(visit.id(), "check_in_time"));
        assertEquals(1, countVisits(member, "status = 'GRANTED' and check_out_time is not null"));
        assertEquals(1, countVisits(member, "true"));
    }

    /** Kiểm thử: quét chờ việc hủy hoàn tất rồi từ chối QR đó dù hội viên có subscription khác. */
    @Test
    void scanWaitsForCancellationAndRejectsThatQrEvenWithAnotherActiveSubscription() throws Exception {
        long member = member();
        SubscriptionFixture cancelled = createSubscription(member, "active", -1, 30);
        subscription(member, "active", -1, 30); // Đảm bảo trigger kiểm tra gói thành viên chung vẫn được thỏa mãn.
        var ready = new CountDownLatch(1);
        var scannerPid = new AtomicInteger();
        Future<CheckinDto> scan;
        try (var cancellation = dataSource.getConnection()) {
            cancellation.setAutoCommit(false);
            try {
                try (var update = cancellation.prepareStatement("update membership_subscriptions set status = 'cancelled' where id = ?")) {
                    update.setLong(1, cancelled.id());
                    assertEquals(1, update.executeUpdate());
                }
                scan = submit(ready, scannerPid, () -> scan(cancelled.dynamicQr()));
                awaitBlocked(ready, scannerPid);
                cancellation.commit();
            } finally {
                cancellation.rollback();
            }
        }
        assertEquals("DENIED", scan.get(20, TimeUnit.SECONDS).status());
        assertEquals(1, countVisits(member, "true"));
        assertEquals(1, countVisits(member, "status = 'DENIED' and denial_reason = 'error.attendance.subscription_not_active'"));
        assertTrue(subscriptions.hasActiveMembership(member, LocalDate.now(clock)));
    }

    /**
     * Kiểm thử: truy vấn membership đang hoạt động gồm cả hai ngày biên và loại trừ kỳ tương lai, hết hạn,
     * không hoạt động.
     */
    @Test
    void activeMembershipQueryIncludesBothDateBoundariesAndExcludesFutureExpiredOrInactive() {
        long missing = member();
        assertFalse(subscriptions.hasActiveMembership(missing, LocalDate.now(clock)));
        for (String state : List.of("future", "expired", "pending_payment", "cancelled", "today")) {
            long member = member();
            String status = List.of("pending_payment", "cancelled").contains(state) ? state : "active";
            int start = state.equals("future") ? 1 : state.equals("today") ? 0 : -30;
            int end = state.equals("expired") ? -1 : state.equals("today") ? 0 : 30;
            subscription(member, status, start, end);
            assertEquals(state.equals("today"), subscriptions.hasActiveMembership(member, LocalDate.now(clock)), state);
        }
    }

    // SCRUM-74: khóa PostgreSQL thật, kết nối độc lập và rào chắn chặn có giới hạn thời gian.
    // Các bài test này yêu cầu project/schema test Supabase biệt lập được cấu hình rõ ràng.
    /** Kiểm thử: hai hội viên tranh chỗ cuối cùng qua khóa lớp thật. */
    @Test
    void twoMembersCompeteForLastSeatThroughRealClassLock() throws Exception {
        long first = bookingMember();
        long second = bookingMember();
        long gymClass = bookingClass(1);
        long session = bookingSession(gymClass);
        var results = raceOnClass(gymClass,
                () -> bookingService.enroll(memberPrincipal(first), session),
                () -> bookingService.enroll(memberPrincipal(second), session));
        assertEquals(1, results.stream().filter(this::succeeded).count());
        assertEquals(1, rowCount("class_enrollments", gymClass, "booked"));
    }

    /** Kiểm thử: tạm hoãn membership và ghi danh được tuần tự hóa theo hội viên trước khi khóa lớp. */
    @Test
    void membershipHoldAndEnrollmentSerializeOnMemberBeforeClass() throws Exception {
        long owner = bookingMember();
        long gymClass = bookingClass(1);
        long session = bookingSession(gymClass);
        long subscriptionId = jdbc.queryForObject("select id from membership_subscriptions where member_id = ?", Long.class, owner);
        jdbc.update("update membership_subscriptions set hold_status = 'PENDING', hold_reason = 'Fixture', hold_requested_at = ? where id = ?",
                LocalDateTime.now(clock), subscriptionId);
        var ready = new CountDownLatch(2);
        var holdPid = new AtomicInteger();
        var enrollPid = new AtomicInteger();
        Future<Object> hold;
        Future<Object> enrollment;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select user_id from members where user_id = ? for update", owner);
                hold = submit(ready, holdPid, () -> membershipService.approveHold(staff, subscriptionId));
                enrollment = submit(ready, enrollPid, () -> bookingService.enroll(memberPrincipal(owner), session));
                awaitBlocked(ready, holdPid, enrollPid);
                blocker.commit();
            } finally {
                blocker.rollback();
            }
        }
        hold.get(20, TimeUnit.SECONDS);
        succeeded(enrollment); // Cho phép ghi danh trước khi tạm hoãn hoặc bị từ chối sau đó; tuyệt đối không được xảy ra deadlock.
        assertEquals("frozen", jdbc.queryForObject("select status from membership_subscriptions where id = ?", String.class, subscriptionId));
        assertEquals(0, rowCount("class_enrollments", gymClass, "booked"));
    }

    /** Kiểm thử: rollback không lưu việc hủy hay các thông báo. */
    @Test
    void rollbackDoesNotPersistCancellationOrNotifications() {
        long owner = bookingMember();
        long gymClass = bookingClass(1);
        long booking = booked(gymClass, owner);
        new TransactionTemplate(transactionManager).execute(status -> {
            bookingService.cancel(memberPrincipal(owner), booking);
            status.setRollbackOnly();
            return null;
        });
        assertEquals(1, rowCount("class_enrollments", gymClass, "booked"));
        assertEquals(0, notificationCount("class_enrollment", booking));
    }

    /** Hàm trợ giúp của test: tạo cuộc đua giữa các luồng cho cùng một lớp. */
    private List<Future<Object>> raceOnClass(long gymClass, Supplier<?> first, Supplier<?> second) throws Exception {
        var ready = new CountDownLatch(2);
        var firstPid = new AtomicInteger();
        var secondPid = new AtomicInteger();
        Future<Object> a;
        Future<Object> b;
        try (var blocker = dataSource.getConnection()) {
            blocker.setAutoCommit(false);
            try {
                lockRow(blocker, "select id from classes where id = ? for update", gymClass);
                a = submit(ready, firstPid, () -> (Object) first.get());
                b = submit(ready, secondPid, () -> (Object) second.get());
                awaitBlocked(ready, firstPid, secondPid);
                blocker.commit();
            } finally {
                blocker.rollback();
            }
        }
        return List.of(a, b);
    }

    /** Hàm trợ giúp của test: kiểm tra một thao tác đồng thời có thành công không. */
    private boolean succeeded(Future<?> result) {
        try {
            result.get(20, TimeUnit.SECONDS);
            return true;
        } catch (ExecutionException error) {
            assertInstanceOf(AppException.class, error.getCause(), "A database failure/deadlock is not a valid business rejection");
            return false;
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }

    /** Hàm trợ giúp của test: tạo principal của hội viên. */
    private AuthenticatedPrincipal memberPrincipal(long member) {
        return new AuthenticatedPrincipal(member, "booking-fixture", "MEMBER");
    }

    /** Hàm trợ giúp của test: tạo hội viên dùng cho đặt chỗ. */
    private long bookingMember() {
        long member = member();
        subscription(member, "active", -1, 365);
        return member;
    }

    /** Hàm trợ giúp của test: tạo lớp dùng cho đặt chỗ. */
    private long bookingClass(int capacity) {
        long coach = user("COACH");
        jdbc.update("insert into coaches (user_id, employment_status) values (?, 'active')", coach);
        return jdbc.queryForObject("""
                insert into classes (name, discipline_id, coach_id, room_id, capacity, level, status, created_at, updated_at)
                values (?, (select min(id) from disciplines), ?, (select min(id) from rooms),
                        ?, 'all', 'active', now(), now()) returning id
                """, Long.class, "Concurrency-" + UUID.randomUUID(), coach, capacity);
    }

    /** Hàm trợ giúp của test: tạo buổi học dùng cho đặt chỗ theo đúng 5 slot chuẩn (Slot 2: 09:45–12:15). */
    private long bookingSession(long gymClass) {
        return jdbc.queryForObject("""
                insert into class_sessions (class_id, session_date, start_time, end_time, status, created_at, updated_at)
                values (?, ?, '09:45', '12:15', 'scheduled', now(), now()) returning id
                """, Long.class, gymClass, LocalDate.now(clock).plusDays(BOOKING_DAY.getAndIncrement()));
    }

    /** Hàm trợ giúp của test: tạo bản ghi đặt chỗ. */
    private long booked(long gymClass, long member) {
        return jdbc.queryForObject("insert into class_enrollments (class_id, member_id, status, enrolled_at) values (?, ?, 'booked', now()) returning id",
                Long.class, gymClass, member);
    }

    /** Hàm trợ giúp của test: đếm số dòng của một bảng. */
    private int rowCount(String table, long gymClass, String status) {
        assertTrue(Set.of("class_enrollments").contains(table));
        return jdbc.queryForObject("select count(*) from " + table + " where class_id = ? and status = ?",
                Integer.class, gymClass, status);
    }

    /** Hàm trợ giúp của test: đếm số thông báo. */
    private int notificationCount(String type, long id) {
        return jdbc.queryForObject("select count(*) from notifications where related_entity_type = ? and related_entity_id = ?",
                Integer.class, type, id);
    }

    /** Hàm trợ giúp của test: gửi một tác vụ vào thread pool. */
    private <T> Future<T> submit(CountDownLatch ready, AtomicInteger backendPid, Supplier<T> action) {
        return workers.submit(() -> new TransactionTemplate(transactionManager).execute(status -> {
            jdbc.execute("set local statement_timeout = '15s'");
            backendPid.set(jdbc.queryForObject("select pg_backend_pid()", Integer.class));
            ready.countDown();
            return action.get();
        }));
    }

    /** Hàm trợ giúp của test: chờ cho đến khi một luồng bị chặn trên khóa. */
    private void awaitBlocked(CountDownLatch ready, AtomicInteger... backendPids) throws InterruptedException {
        assertTrue(ready.await(10, TimeUnit.SECONDS), "All workers must enter their transactions");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            boolean allBlocked = true;
            for (AtomicInteger backendPid : backendPids) {
                allBlocked &= Boolean.TRUE.equals(jdbc.queryForObject(
                        "select exists(select 1 from pg_stat_activity where pid = ? and wait_event_type = 'Lock')",
                        Boolean.class, backendPid.get()));
            }
            if (allBlocked) return;
            Thread.sleep(25);
        }
        fail("Every operation must actually wait on a PostgreSQL row lock before release");
    }

    /** Hàm trợ giúp của test: giữ khóa một dòng để các luồng khác phải chờ. */
    private static void lockRow(Connection connection, String sql, long id) throws Exception {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, id);
            try (var result = statement.executeQuery()) {
                assertTrue(result.next());
            }
        }
    }

    /** Hàm trợ giúp của test: thực hiện check-out và trả kết quả. */
    private static CheckinDto checkoutResult(Future<CheckinDto> result) throws Exception {
        try {
            return result.get(20, TimeUnit.SECONDS);
        } catch (ExecutionException error) {
            var failure = assertInstanceOf(BadRequestException.class, error.getCause());
            assertEquals("CHECKIN_ALREADY_CHECKED_OUT", failure.getErrorCode());
            return null;
        }
    }

    /** Hàm trợ giúp của test: thực hiện quét QR và trả kết quả. */
    private CheckinDto scan(String qr) {
        return checkins.scan(staff, new CheckinRequests.Scan(qr, "Integration gate"));
    }

    /** Hàm trợ giúp của test: đếm số lượt vào cổng của hội viên. */
    private int countVisits(long member, String condition) {
        return jdbc.queryForObject("select count(*) from center_checkins where member_id = ? and " + condition,
                Integer.class, member);
    }

    /** Hàm trợ giúp của test: tạo mốc thời gian dùng trong test. */
    private LocalDateTime timestamp(long visit, String column) {
        return jdbc.queryForObject("select " + column + " from center_checkins where id = ?", LocalDateTime.class, visit);
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (user). */
    private long user(String role) {
        return jdbc.queryForObject("""
                insert into users (role_id, full_name, email, password_hash, status, created_at, updated_at)
                values ((select id from roles where code = ?), 'Operations fixture', ?, 'unused', 'active', now(), now()) returning id
                """, Long.class, role, UUID.randomUUID() + "@example.invalid");
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (member). */
    private long member() {
        long member = user("MEMBER");
        jdbc.update("insert into members (user_id, membership_code, join_date, fitness_level) values (?, ?, current_date, 'beginner')",
                member, "OPERATIONS-" + member);
        return member;
    }

    private record SubscriptionFixture(long id, String dynamicQr) {}

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (subscription kèm Dynamic QR ký 60 giây). */
    private SubscriptionFixture createSubscription(long member, String status, int startOffset, int endOffset) {
        String qr = UUID.randomUUID().toString();
        LocalDate today = LocalDate.now(clock);
        long subId = jdbc.queryForObject("""
                insert into membership_subscriptions
                    (member_id, package_id, start_date, end_date, status, qr_code, created_at, updated_at)
                values (?, (select min(id) from membership_packages), ?, ?, ?, ?, now(), now()) returning id
                """, Long.class, member, today.plusDays(startOffset), today.plusDays(endOffset), status, qr);
        return new SubscriptionFixture(subId, dynamicQrService.generate(member, subId, clock.millis()));
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (trả về Dynamic QR động hợp lệ). */
    private String subscription(long member, String status, int startOffset, int endOffset) {
        return createSubscription(member, status, startOffset, endOffset).dynamicQr();
    }

    /** Hàm trợ giúp của test: tạo thông tin đăng nhập kết nối test. */
    private static String credential(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("Set " + name + " for Supabase tests");
        return value;
    }

    /** Hàm trợ giúp của test: kết nối tới database test. */
    private static Connection connectTestDatabase() throws SQLException {
        String url = credential("SCMS_POSTGRES_TEST_URL");
        String sslMode = System.getenv().getOrDefault("DB_SSL_MODE", "require");
        if (!url.startsWith("jdbc:postgresql:")
                || url.matches("(?is).*[?&](?:user|password|ssl|sslmode|sslfactory)=.*")
                || !Set.of("require", "verify-ca", "verify-full").contains(sslMode)) {
            throw new IllegalStateException("Supabase tests require a PostgreSQL URL and encrypted TLS");
        }
        Properties settings = new Properties();
        settings.setProperty("user", credential("SCMS_POSTGRES_TEST_USERNAME"));
        settings.setProperty("password", credential("SCMS_POSTGRES_TEST_PASSWORD"));
        settings.setProperty("sslmode", sslMode);
        String certificate = System.getenv("DB_SSL_ROOT_CERT");
        if (certificate != null && !certificate.isBlank()) settings.setProperty("sslrootcert", certificate);
        return DriverManager.getConnection(url, settings);
    }
}
