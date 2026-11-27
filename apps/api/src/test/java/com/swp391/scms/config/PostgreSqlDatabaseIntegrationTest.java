package com.swp391.scms.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.UUID;
import javax.sql.DataSource;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static com.swp391.scms.config.SupabaseTestDatabase.credential;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Bộ kiểm thử tích hợp trên cơ sở dữ liệu PostgreSQL.
 * Chạy trên Supabase PostgreSQL thật, dùng schema mới đặt tên duy nhất và không bao giờ đặt lại schema public.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("supabase")
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class PostgreSqlDatabaseIntegrationTest {
    private static final String SCHEMA = "scrum91_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final String ADMIN_EMAIL = "scrum91-test@example.invalid";
    private static final String ADMIN_PASSWORD = "IntegrationTest_91!";

    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory entities;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    /** Hàm trợ giúp của test: lấy kết nối database test. */
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) throws Exception {
        // Tên schema được sinh trực tiếp tại đây, không bao giờ lấy từ cấu hình bên ngoài.
        try (var connection = SupabaseTestDatabase.connect();
             var statement = connection.createStatement()) {
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
        properties.add("app.bootstrap.admin.email", () -> ADMIN_EMAIL);
        properties.add("app.bootstrap.admin.password", () -> ADMIN_PASSWORD);
        properties.add("app.auth.otp.delivery", () -> "disabled");
    }

    /** Dọn dẹp sau test: xóa dữ liệu và schema đã tạo. */
    @AfterAll
    static void cleanup() throws Exception {
        assertTrue(SCHEMA.matches("scrum91_test_[a-f0-9]{32}"));
        try (var connection = SupabaseTestDatabase.connect();
             var statement = connection.createStatement()) {
            statement.execute("drop schema if exists \"" + SCHEMA + "\" cascade");
        }
    }

    @Autowired com.swp391.scms.membership.service.MembershipRealtimeService realtime;

    /** Kiểm thử: broadcast Supabase không chứa dữ liệu và chỉ được gửi sau khi commit. */
    @Test
    @EnabledIfEnvironmentVariable(named = "SUPABASE_PUBLISHABLE_KEY", matches = "sb_publishable_.+")
    void supabaseBroadcastIsDataFreeAndOnlyDeliveredAfterCommit() throws Exception {
        long owner = member();
        var session = realtime.open(new com.swp391.scms.security.AuthenticatedPrincipal(owner, "fixture", "MEMBER"));
        assertEquals(session.topic(), "membership:" + jdbc.queryForObject("select payment_realtime_topic from members where user_id = ?", String.class, owner));
        assertTrue(session.enabled(), "Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for live Realtime QA");
        var joined = new CountDownLatch(1);
        var events = new LinkedBlockingQueue<com.fasterxml.jackson.databind.JsonNode>();
        var buffer = new StringBuilder();
        var uri = java.net.URI.create(session.url().replace("https://", "wss://")
                + "/realtime/v1/websocket?apikey=" + session.publishableKey() + "&vsn=1.0.0");
        var socket = java.net.http.HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(uri, new java.net.http.WebSocket.Listener() {
                    @Override public void onOpen(java.net.http.WebSocket ws) { ws.request(1); }
                    @Override public java.util.concurrent.CompletionStage<?> onText(java.net.http.WebSocket ws, CharSequence text, boolean last) {
                        buffer.append(text);
                        if (last) {
                            try {
                                var frame = json.readTree(buffer.toString());
                                if ("phx_reply".equals(frame.path("event").asText())
                                        && "ok".equals(frame.path("payload").path("status").asText())) joined.countDown();
                                if ("broadcast".equals(frame.path("event").asText())) events.add(frame.path("payload"));
                            } catch (Exception e) { throw new RuntimeException(e); }
                            buffer.setLength(0);
                        }
                        ws.request(1);
                        return null;
                    }
                }).get(20, TimeUnit.SECONDS);
        try {
            socket.sendText(json.writeValueAsString(java.util.Map.of("topic", "realtime:" + session.topic(),
                    "event", "phx_join", "payload", java.util.Map.of("config", java.util.Map.of(
                        "broadcast", java.util.Map.of("ack", false, "self", false),
                        "presence", java.util.Map.of("enabled", false), "postgres_changes", java.util.List.of(), "private", false)), "ref", "1")), true).join();
            assertTrue(joined.await(15, TimeUnit.SECONDS), "Supabase channel must subscribe");
            try (var connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try (var insert = connection.prepareStatement("insert into payments (member_id,amount,method,status,created_at) values (?,299000,'cash','pending',now())")) {
                    insert.setLong(1, owner); insert.executeUpdate();
                    var warning = insert.getWarnings();
                    assertNull(warning, "Realtime SQL warning: " + String.valueOf(warning));
                    assertNull(events.poll(800, TimeUnit.MILLISECONDS), "Uncommitted data must not emit");
                    connection.commit();
                    var event = events.poll(15, TimeUnit.SECONDS);
                    assertNotNull(event, "Committed payment must emit through Supabase Realtime");
                    assertEquals("changed", event.path("event").asText());
                    assertTrue(event.path("payload").isObject());
                    assertTrue(event.path("payload").size() <= 1, "Only Supabase-generated delivery ID is allowed");
                    assertTrue(!event.path("payload").has("id") || event.path("payload").path("id").asText().matches("[a-f0-9-]{36}"));
                    insert.executeUpdate();
                    connection.rollback();
                    assertNull(events.poll(1200, TimeUnit.MILLISECONDS), "Rollback must not emit");
                } finally { connection.rollback(); connection.setAutoCommit(true); }
            }
            // Thay đổi khoản thanh toán của hội viên khác không được gửi tới kênh này.
            long other = member();
            jdbc.update("insert into payments (member_id,amount,method,status,created_at) values (?,499000,'cash','pending',now())", other);
            assertNull(events.poll(800, TimeUnit.MILLISECONDS));
        } finally { socket.sendClose(1000, "done").join(); }
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (user). */
    private long user(String role) {
        return jdbc.queryForObject("""
                insert into users (role_id, full_name, email, password_hash, status, created_at, updated_at)
                values ((select id from roles where code = ?), 'Nguyễn Test', ?, 'unused', 'active', now(), now()) returning id
                """, Long.class, role, UUID.randomUUID() + "@example.invalid");
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (member). */
    private long member() {
        long id = user("MEMBER");
        jdbc.update("insert into members (user_id, membership_code, join_date, fitness_level) values (?, ?, current_date, 'beginner')",
                id, "TEST-" + id);
        return id;
    }

    /** Hàm trợ giúp của test: tạo subscription mẫu. */
    private void subscription(long member, String status, int startOffset, int endOffset) {
        jdbc.update("""
                insert into membership_subscriptions
                    (member_id, package_id, start_date, end_date, status, created_at, updated_at)
                values (?, (select min(id) from membership_packages), current_date + ?, current_date + ?, ?, now(), now())
                """, member, startOffset, endOffset, status);
    }

    /** Hàm trợ giúp của test: tạo hội viên có membership đang hoạt động. */
    private long activeMember() {
        long id = member();
        subscription(id, "active", -1, 30);
        return id;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (coach). */
    private long coach() {
        long id = user("COACH");
        jdbc.update("insert into coaches (user_id, employment_status) values (?, 'active')", id);
        return id;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (room). */
    private long room() {
        return jdbc.queryForObject("insert into rooms (name, capacity, status) values (?, 10, 'available') returning id",
                Long.class, "Room " + UUID.randomUUID());
    }

    /** Hàm trợ giúp của test: tạo bộ môn riêng biệt để các test không xung đột nhau. */
    private long discipline() {
        return jdbc.queryForObject(
                "insert into disciplines (name, description, created_at) values (?, 'Integration test discipline', now()) returning id",
                Long.class, "Discipline " + UUID.randomUUID());
    }

    /** Hàm trợ giúp của test: lấy id bộ môn chuẩn đã được seed theo tên. */
    private long discipline(String name) {
        return jdbc.queryForObject("select id from disciplines where lower(name) = lower(?) order by id limit 1",
                Long.class, name);
    }

    /** Hàm trợ giúp của test: tạo lớp học mẫu thuộc bộ môn mặc định. */
    private long gymClass(int capacity, long coach, long room) {
        return jdbc.queryForObject("""
                insert into classes (name, discipline_id, coach_id, room_id, capacity, level, status, created_at, updated_at)
                values (?, (select min(id) from disciplines), ?, ?, ?, 'all', 'active', now(), now()) returning id
                """, Long.class, "Class " + UUID.randomUUID(), coach, room, capacity);
    }

    /** Hàm trợ giúp của test: tạo lớp học mẫu thuộc một bộ môn chỉ định. */
    private long gymClass(int capacity, long coach, long room, long disciplineId) {
        return jdbc.queryForObject("""
                insert into classes (name, discipline_id, coach_id, room_id, capacity, level, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'all', 'active', now(), now()) returning id
                """, Long.class, "Class " + UUID.randomUUID(), disciplineId, coach, room, capacity);
    }

    /** Hàm trợ giúp của test: ghi danh hội viên vào buổi học. */
    private void enroll(long gymClass, long member, String status) {
        jdbc.update("insert into class_enrollments (class_id, member_id, status, enrolled_at) values (?, ?, ?, now())",
                gymClass, member, status);
    }

    /** Hàm trợ giúp của test: tạo buổi học mẫu vào ngày hiện tại. */
    private void session(long gymClass, String start, String end, String status) {
        session(gymClass, 0, start, end, status);
    }

    /** Hàm trợ giúp của test: tạo buổi học mẫu lệch số ngày so với ngày hiện tại. */
    private void session(long gymClass, int dayOffset, String start, String end, String status) {
        jdbc.update("""
                insert into class_sessions (class_id, session_date, start_time, end_time, status, created_at, updated_at)
                values (?, current_date + ?, cast(? as time), cast(? as time), ?, now(), now())
                """, gymClass, dayOffset, start, end, status);
    }

    /** Hàm trợ giúp của test: tạo lượt đặt PT mẫu. */
    private void ptBooking(long member, long coach, String start, String end) {
        jdbc.update("""
                insert into coach_bookings (member_id, coach_id, booking_date, start_time, end_time,
                    hourly_rate, payment_method, payment_status, status, created_at)
                values (?, ?, current_date, cast(? as time), cast(? as time), 200000, 'cash', 'pending', 'confirmed', now())
                """, member, coach, start, end);
    }

    /** Kiểm thử: trigger cho phép HLV nhận cả 5 slot PT cố định liên tiếp trong ngày và từ chối khung ngoài 5 slot. */
    @Test
    void ptTriggerAllowsAllFiveCanonicalSlotsAndRejectsInvalidSlots() {
        long coach = coach();
        ptBooking(activeMember(), coach, "07:00", "09:30");
        ptBooking(activeMember(), coach, "09:45", "12:15");
        ptBooking(activeMember(), coach, "12:30", "15:00");
        ptBooking(activeMember(), coach, "15:15", "17:45");
        ptBooking(activeMember(), coach, "18:00", "20:30");

        var invalidPt = assertThrows(DataIntegrityViolationException.class,
                () -> ptBooking(activeMember(), coach(), "08:00", "09:00"));
        assertTrue(invalidPt.getMostSpecificCause().getMessage().contains("trg_schedule_invalid_slot"));

        long group = gymClass(10, coach(), room());
        var invalidSession = assertThrows(DataIntegrityViolationException.class,
                () -> session(group, "08:00", "09:00", "scheduled"));
        assertTrue(invalidSession.getMostSpecificCause().getMessage().contains("trg_schedule_invalid_slot"));
    }

    /** Kiểm thử: trigger PT từ chối trùng lịch hai chiều và yêu cầu membership. */
    @Test
    void ptTriggerRejectsConflictsInBothBookingDirectionsAndRequiresMembership() {
        long coach = coach(), member = activeMember();
        ptBooking(member, coach, "15:15", "17:45");
        assertThrows(DataIntegrityViolationException.class, () -> ptBooking(activeMember(), coach, "15:15", "17:45"));
        assertThrows(DataIntegrityViolationException.class, () -> ptBooking(member, coach(), "15:15", "17:45"));
        assertThrows(DataIntegrityViolationException.class, () -> ptBooking(member(), coach(), "18:00", "20:30"));
        long group = gymClass(10, coach(), room(), discipline("Gym"));
        session(group, "15:15", "17:45", "scheduled");
        assertThrows(DataIntegrityViolationException.class, () -> enroll(group, member, "booked"));
        long other = activeMember();
        enroll(group, other, "booked");
        assertThrows(DataIntegrityViolationException.class, () -> ptBooking(other, coach(), "15:15", "17:45"));
        // Dùng bộ môn khác (Boxing vs Gym) để trigger xung đột bộ môn không che khuất trigger PT↔Group của HLV.
        long coachedGroup = gymClass(10, coach, room(), discipline("Boxing"));
        var coachedConflict = assertThrows(DataIntegrityViolationException.class,
                () -> session(coachedGroup, "15:15", "17:45", "scheduled"));
        assertConstraintViolation(coachedConflict, "23514", "trg_sessions_check_conflict");
        ptBooking(member, coach, "18:00", "20:30");
    }

    /** Kiểm thử: các lượt đặt PT đồng thời không thể đặt trùng một HLV. */
    @Test
    void concurrentPtBookingsCannotDoubleBookCoach() throws Exception {
        long coach = coach(), first = activeMember(), second = activeMember();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var one = executor.submit(() -> ptAfterLatch(start, first, coach));
            var two = executor.submit(() -> ptAfterLatch(start, second, coach));
            start.countDown();
            assertEquals(1, (one.get(15, TimeUnit.SECONDS) ? 1 : 0) + (two.get(15, TimeUnit.SECONDS) ? 1 : 0));
        }
    }

    /** Hàm trợ giúp của test: thực hiện đặt PT sau khi các luồng đã sẵn sàng (latch). */
    private boolean ptAfterLatch(CountDownLatch start, long member, long coach) throws Exception {
        start.await();
        try {
            ptBooking(member, coach, "18:00", "20:30");
            return true;
        } catch (DataIntegrityViolationException expected) {
            String reason = expected.getMostSpecificCause().getMessage();
            assertTrue(reason.contains("trg_sessions_check_conflict") || reason.contains("trg_pt_schedule_busy"));
            return false;
        }
    }

    /** Kiểm thử: Hibernate khởi tạo đủ các bảng tham chiếu và các trigger bắt buộc. */
    @Test
    void hibernateBootstrapsAllReferenceTablesAndMandatoryTriggers() {
        assertTrue(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema = ?",
                Integer.class, SCHEMA) >= 33);
        var installedTriggers = jdbc.queryForList("""
                select t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = ? and not t.tgisinternal
                """, String.class, SCHEMA);
        assertTrue(installedTriggers.size() >= 21, "Expected all 21 triggers from postgresql-triggers.sql, found: " + installedTriggers);
        var mandatoryTriggers = java.util.Set.of(
                "trg_users_updated_at",
                "trg_sessions_check_conflict",
                "trg_enrollments_check_capacity",
                "trg_enrollments_check_membership",
                "trg_session_bookings_check_capacity",
                "trg_session_bookings_check_membership",
                "trg_checkins_check_membership",
                "trg_pt_schedule_booking",
                "trg_pt_schedule_enrollment",
                "trg_pt_schedule_session_booking",
                "trg_pt_schedule_session",
                "trg_pt_schedule_class",
                "trg_member_overlap_enrollment",
                "trg_member_overlap_session",
                "trg_member_overlap_session_booking"
        );
        assertTrue(installedTriggers.containsAll(mandatoryTriggers),
                "Missing mandatory triggers from " + installedTriggers);
    }

    /** Kiểm thử: trigger sức chứa từ chối vượt chỗ và rollback. */
    @Test
    void capacityTriggerRejectsOverflowAndRollsBack() {
        long gymClass = gymClass(1, coach(), room());
        enroll(gymClass, activeMember(), "booked");
        long rejected = activeMember();
        var error = assertThrows(DataIntegrityViolationException.class, () -> enroll(gymClass, rejected, "booked"));
        assertTrue(error.getMostSpecificCause().getMessage().contains("Lớp học đã đầy chỗ (vượt quá capacity cho phép)."));
        assertEquals(1, jdbc.queryForObject("select count(*) from class_enrollments where class_id = ?", Integer.class, gymClass));
    }

    /** Kiểm thử: các lượt đặt đồng thời không thể lấy cùng một chỗ cuối cùng. */
    @Test
    void concurrentBookingsCannotTakeTheSameLastSlot() throws Exception {
        long gymClass = gymClass(1, coach(), room());
        long first = activeMember(), second = activeMember();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> booking1 = () -> bookAfterLatch(start, gymClass, first);
            Callable<Boolean> booking2 = () -> bookAfterLatch(start, gymClass, second);
            Future<Boolean> a = pool.submit(booking1), b = pool.submit(booking2);
            start.countDown();
            int successes = (a.get(30, TimeUnit.SECONDS) ? 1 : 0) + (b.get(30, TimeUnit.SECONDS) ? 1 : 0);
            assertEquals(1, successes);
            assertEquals(1, jdbc.queryForObject("select count(*) from class_enrollments where class_id = ? and status = 'booked'", Integer.class, gymClass));
        } finally {
            pool.shutdownNow();
        }
    }

    /** Hàm trợ giúp của test: thực hiện đặt chỗ sau khi các luồng đã sẵn sàng (latch). */
    private boolean bookAfterLatch(CountDownLatch start, long gymClass, long member) throws Exception {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        try {
            enroll(gymClass, member, "booked");
            return true;
        } catch (DataIntegrityViolationException e) {
            var cause = assertInstanceOf(SQLException.class, e.getMostSpecificCause());
            assertEquals("23514", cause.getSQLState());
            String message = cause.getMessage();
            assertTrue(
                    message != null && (message.contains("Lớp học đã đầy chỗ (vượt quá capacity cho phép).")
                            || message.contains("trg_pt_schedule_busy")),
                    () -> "Unexpected 23514 trigger message: " + message);
            return false;
        }
    }

    /** Hàm trợ giúp của test: khẳng định thao tác vi phạm trigger của database. */
    private static void assertTriggerViolation(DataIntegrityViolationException error, String expectedMessage) {
        // PostgreSQL gửi CONSTRAINT dưới dạng trường giao thức riêng, không nằm trong getMessage().
        var cause = assertInstanceOf(SQLException.class, error.getMostSpecificCause());
        assertEquals("23514", cause.getSQLState());
        assertTrue(cause.getMessage().contains(expectedMessage), cause.getMessage());
    }

    /** Hàm trợ giúp của test: khẳng định lỗi SQL mang đúng SQLState và tên constraint/trigger từ PostgreSQL. */
    private static void assertConstraintViolation(DataIntegrityViolationException error,
            String expectedSqlState, String expectedConstraint) {
        var psql = assertInstanceOf(org.postgresql.util.PSQLException.class, error.getMostSpecificCause());
        assertEquals(expectedSqlState, psql.getSQLState(), psql.getMessage());
        assertNotNull(psql.getServerErrorMessage(), psql.getMessage());
        assertEquals(expectedConstraint, psql.getServerErrorMessage().getConstraint(), psql.getMessage());
    }

    /** Kiểm thử: partial index cho phép lịch sử nhưng từ chối ghi danh active trùng. */
    @Test
    void partialIndexAllowsHistoryButRejectsDuplicateActiveEnrollment() {
        long gymClass = gymClass(10, coach(), room()), member = activeMember();
        enroll(gymClass, member, "cancelled");
        enroll(gymClass, member, "cancelled");
        enroll(gymClass, member, "booked");
        var duplicate = assertThrows(DataIntegrityViolationException.class, () -> enroll(gymClass, member, "booked"));
        assertTrue(duplicate.getMostSpecificCause().getMessage().contains("uq_enrollment_active"));
    }

    /** Kiểm thử: trigger buổi học từ chối trùng HLV/phòng nhưng cho phép slot kế tiếp hoặc buổi đã hủy. */
    @Test
    void sessionTriggerRejectsCoachAndRoomOverlapButAllowsAdjacentOrCancelledSessions() {
        long coach = coach(), room = room();
        long original = gymClass(10, coach, room);
        session(original, "07:00", "09:30", "scheduled");
        long sameCoach = gymClass(10, coach, room());
        long sameRoom = gymClass(10, coach(), room);
        for (long conflicting : new long[]{sameCoach, sameRoom}) {
            var error = assertThrows(DataIntegrityViolationException.class, () -> session(conflicting, "07:00", "09:30", "scheduled"));
            assertTrue(error.getMostSpecificCause().getMessage().contains("Huấn luyện viên hoặc phòng tập đã có lịch trùng khung giờ này."));
        }
        session(sameCoach, "09:45", "12:15", "scheduled");
        session(sameRoom, "07:00", "09:30", "cancelled");
    }

    /**
     * Kiểm thử: cho phép nhiều lớp active cùng bộ môn ở các slot khác nhau nhưng từ chối hai lớp active
     * cùng bộ môn trùng ngày và slot dù khác HLV và khác phòng.
     */
    @Test
    void disciplineConflictTriggerAllowsMultipleActiveClassesNonOverlappingAndRejectsSameDateSlotOverlap() {
        long sharedDiscipline = discipline();
        long firstClass = gymClass(10, coach(), room(), sharedDiscipline);
        long secondClass = gymClass(10, coach(), room(), sharedDiscipline);
        long otherDisciplineClass = gymClass(10, coach(), room(), discipline());

        session(firstClass, "07:00", "09:30", "scheduled");
        session(secondClass, "09:45", "12:15", "scheduled");

        var conflict = assertThrows(DataIntegrityViolationException.class,
                () -> session(secondClass, "07:00", "09:30", "scheduled"));
        assertConstraintViolation(conflict, "23P01", "trg_sessions_check_discipline_conflict");
        assertTrue(conflict.getMostSpecificCause().getMessage()
                .contains("Bộ môn này đã có lớp học khác trùng khung giờ."));

        // Lớp thuộc bộ môn khác vẫn mở song song được trong cùng ngày và cùng slot với phòng/HLV riêng.
        session(otherDisciplineClass, "07:00", "09:30", "scheduled");
    }

    @Test
    void slotDisciplineLimitRejectsThirdSportAndReleasesCancelledSlot() {
        long first = gymClass(10, coach(), room(), discipline());
        long second = gymClass(10, coach(), room(), discipline());
        long third = gymClass(10, coach(), room(), discipline());
        session(first, 53, "07:00", "09:30", "scheduled");
        session(second, 53, "07:00", "09:30", "scheduled");
        var conflict = assertThrows(DataIntegrityViolationException.class, () -> session(third, 53, "07:00", "09:30", "scheduled"));
        assertConstraintViolation(conflict, "23P01", "trg_sessions_slot_discipline_limit");
        session(third, 53, "09:45", "12:15", "scheduled");
        jdbc.update("update class_sessions set status = 'cancelled' where class_id = ?", second);
        session(third, 53, "07:00", "09:30", "scheduled");
    }

    /** Kiểm thử: trigger chồng lịch hội viên từ chối ghi danh hai lớp nhóm khác bộ môn trùng ngày và slot. */
    @Test
    void memberClassOverlapTriggerRejectsConflictingEnrollments() {
        long member = activeMember();
        long firstClass = gymClass(10, coach(), room(), discipline());
        long secondClass = gymClass(10, coach(), room(), discipline());
        long adjacentClass = gymClass(10, coach(), room(), discipline());

        // Dùng ngày current_date + 2 để luôn >= today theo Asia/Ho_Chi_Minh ở mọi múi giờ server PostgreSQL.
        session(firstClass, 2, "12:30", "15:00", "scheduled");
        session(secondClass, 2, "12:30", "15:00", "scheduled");
        session(adjacentClass, 2, "15:15", "17:45", "scheduled");

        enroll(firstClass, member, "booked");
        enroll(adjacentClass, member, "booked");

        var overlap = assertThrows(DataIntegrityViolationException.class,
                () -> enroll(secondClass, member, "booked"));
        assertConstraintViolation(overlap, "23P01", "trg_member_schedule_conflict");
        assertTrue(overlap.getMostSpecificCause().getMessage().contains("trg_member_schedule_conflict"));
        assertEquals(0, jdbc.queryForObject(
                "select count(*) from class_enrollments where class_id = ? and member_id = ? and status = 'booked'",
                Integer.class, secondClass, member));
    }

    /** Kiểm thử: trigger membership từ chối subscription thiếu, hết hạn, không hoạt động hoặc ở tương lai. */
    @Test
    void membershipTriggersRejectMissingExpiredInactiveAndFutureSubscriptions() {
        long gymClass = gymClass(10, coach(), room());
        for (String state : new String[]{"missing", "expired", "pending_payment", "future"}) {
            long member = member();
            if (!state.equals("missing")) {
                subscription(member, state.equals("future") ? "active" : state,
                        state.equals("future") ? 2 : -30, state.equals("expired") ? -2 : 30);
            }
            var booking = assertThrows(DataIntegrityViolationException.class, () -> enroll(gymClass, member, "booked"));
            assertTriggerViolation(booking, "Học viên không có gói thành viên còn hiệu lực để đăng ký lớp.");
            var checkin = assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                    "insert into center_checkins (member_id, check_in_time, method) values (?, now(), 'qr')", member));
            assertTriggerViolation(checkin, "Học viên không có gói thành viên còn hiệu lực để check-in.");
        }
        long valid = activeMember();
        enroll(gymClass, valid, "booked");
        jdbc.update("insert into center_checkins (member_id, check_in_time, method) values (?, now(), 'qr')", valid);
    }

    /** Kiểm thử: cột tính toán được lưu và database tự tính lại. */
    @Test
    void generatedColumnsAreStoredAndRecomputedByDatabase() {
        long member = activeMember();
        long payment = jdbc.queryForObject("""
                insert into payments (member_id, amount, method, status, created_at)
                values (?, 100, 'cash', 'success', now()) returning id
                """, Long.class, member);
        long invoice = jdbc.queryForObject("""
                insert into invoices (payment_id, invoice_number, issued_at, subtotal_amount, tax_amount, created_at)
                values (?, ?, now(), 100, 10, now()) returning id
                """, Long.class, payment, UUID.randomUUID().toString());
        assertEquals(0, new BigDecimal("110").compareTo(jdbc.queryForObject("select total_amount from invoices where id = ?", BigDecimal.class, invoice)));
        jdbc.update("update invoices set subtotal_amount = 200 where id = ?", invoice);
        assertEquals(0, new BigDecimal("210").compareTo(jdbc.queryForObject("select total_amount from invoices where id = ?", BigDecimal.class, invoice)));
        long item = jdbc.queryForObject("insert into invoice_items (invoice_id, description, quantity, unit_price) values (?, 'Test', 2, 25) returning id", Long.class, invoice);
        assertEquals(0, new BigDecimal("50").compareTo(jdbc.queryForObject("select amount from invoice_items where id = ?", BigDecimal.class, item)));
        jdbc.update("update invoice_items set quantity = 3 where id = ?", item);
        assertEquals(0, new BigDecimal("75").compareTo(jdbc.queryForObject("select amount from invoice_items where id = ?", BigDecimal.class, item)));
    }

    /** Kiểm thử: JSON dùng kiểu JSONB gốc và từ chối dữ liệu không hợp lệ. */
    @Test
    void jsonIsNativeJsonbAndRejectsInvalidInput() {
        assertEquals("jsonb", jdbc.queryForObject("select udt_name from information_schema.columns where table_schema = ? and table_name = 'report_snapshots' and column_name = 'data'", String.class, SCHEMA));
        jdbc.update("insert into report_snapshots (report_type, period_start, period_end, data, generated_at) values ('revenue', current_date, current_date, ?::jsonb, now())", "{\"total\":91}");
        assertThrows(org.springframework.dao.DataAccessException.class, () -> jdbc.update(
                "insert into report_snapshots (report_type, period_start, period_end, data, generated_at) values ('revenue', current_date, current_date, ?::jsonb, now())", "not-json"));
    }

    /** Kiểm thử: ràng buộc CHECK của entity từ chối trạng thái nghiệp vụ sai ngay tại database. */
    @Test
    void entityChecksRejectInvalidBusinessStatesOnTheDatabase() {
        long gymClass = gymClass(10, coach(), room());
        var error = assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update("update classes set status = 'invalid' where id = ?", gymClass));
        assertTrue(error.getMostSpecificCause().getMessage().contains("ck_classes_status"));
    }

    /** Kiểm thử: RLS của Supabase được bật cho các bảng ứng dụng và chủ sở hữu vẫn đọc được. */
    @Test
    void supabaseRlsIsEnabledForApplicationTablesAndOwnerCanStillRead() {
        new PostgreSqlDataSecurityInitializer(entities, jdbc).run(new DefaultApplicationArguments());
        assertEquals(0, jdbc.queryForObject("select count(*) from pg_tables where schemaname = ? and not rowsecurity", Integer.class, SCHEMA));
        assertTrue(jdbc.queryForObject("select count(*) from roles", Integer.class) >= 4);
    }

    /** Kiểm thử: RLS từ chối đọc với role không bypass dù đã cấp quyền bảng. */
    @Test
    void rlsDeniesReadsForAnAvailableNonBypassRoleEvenWithTableGrants() throws Exception {
        var roles = jdbc.queryForList("""
                select rolname from pg_roles
                where rolname in ('anon', 'pg_read_all_data')
                  and not rolbypassrls and not rolsuper and pg_has_role(oid, 'MEMBER')
                order by rolname limit 1
                """, String.class);
        Assumptions.assumeFalse(roles.isEmpty(), "Test JDBC role must be allowed to SET ROLE anon or pg_read_all_data");
        String role = roles.getFirst(); // Chọn từ danh sách cho phép cố định, không bao giờ lấy từ đầu vào người dùng.
        new PostgreSqlDataSecurityInitializer(entities, jdbc).run(new DefaultApplicationArguments());
        jdbc.execute("grant usage on schema \"" + SCHEMA + "\" to \"" + role + "\"");
        jdbc.execute("grant select on all tables in schema \"" + SCHEMA + "\" to \"" + role + "\"");
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("set local role \"" + role + "\"");
                try (var result = statement.executeQuery("select count(*) from roles")) {
                    assertTrue(result.next());
                    assertEquals(0, result.getInt(1));
                }
            } finally {
                connection.rollback();
                connection.setAutoCommit(true);
            }
        }
    }

    /** Kiểm thử: các endpoint HTTP hiện có dùng persistence PostgreSQL thật và JWT đúng phân quyền. */
    @Test
    void existingHttpEndpointsUseRealPostgresPersistenceAndJwt() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/payments/member/1")).andExpect(status().isUnauthorized());
        String adminLogin = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String adminToken = json.readTree(adminLogin).path("data").path("token").asText();
        assertFalse(adminToken.isBlank());
        long member = activeMember();
        for (String route : new String[]{"/api/v1/users", "/api/v1/roles", "/api/v1/admin/audit-logs",
                "/api/v1/disciplines", "/api/v1/rooms", "/api/v1/packages"}) {
            mvc.perform(get(route).header("Authorization", "Bearer " + adminToken)).andExpect(status().isOk());
        }
        // Admin không có quyền nghiệp vụ thu ngân/thanh toán; chỉ CENTER_MANAGER hoặc RECEPTIONIST được phép.
        mvc.perform(get("/api/v1/payments/member/" + member).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        String managerEmail = "scrum91-manager-" + UUID.randomUUID() + "@example.invalid";
        jdbc.update("""
                insert into users (role_id, full_name, email, password_hash, status, created_at, updated_at)
                values ((select id from roles where code = 'CENTER_MANAGER'), 'Center Manager Test', ?, ?, 'active', now(), now())
                """, managerEmail, passwordEncoder.encode(ADMIN_PASSWORD));
        String managerLogin = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + managerEmail + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String managerToken = json.readTree(managerLogin).path("data").path("token").asText();
        assertFalse(managerToken.isBlank());
        mvc.perform(get("/api/v1/payments/member/" + member).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk());
        String payment = mvc.perform(post("/api/v1/payments").header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":" + member
                                + ",\"amount\":91000,\"method\":\"cash\",\"status\":\"success\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long paymentId = json.readTree(payment).path("data").path("id").asLong();
        assertTrue(paymentId > 0);
        mvc.perform(post("/api/v1/invoices/auto-issue/" + paymentId).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.totalAmount").value(91000));
        mvc.perform(get("/api/v1/invoices/by-payment/" + paymentId).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].amount").value(91000));
    }
}
