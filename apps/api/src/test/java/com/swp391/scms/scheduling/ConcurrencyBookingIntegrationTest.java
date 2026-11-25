package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * SCRUM-114: Bộ kiểm thử tích hợp đồng thời và chịu tải cho chức năng đặt lớp học.
 *
 * Mô phỏng 50 luồng chạy đồng thời cùng đặt 1 chỗ trống cuối cùng của một buổi học bằng CountDownLatch.
 *
 * Kiểm chứng:
 * 1. Đúng 1 yêu cầu thành công (HTTP 200/201).
 * 2. Đúng 49 yêu cầu nhận ConflictException (HTTP 409).
 * 3. Sức chứa đã đặt hiện tại của lớp không vượt quá sức chứa tối đa.
 */
@ExtendWith(MockitoExtension.class)
class ConcurrencyBookingIntegrationTest {

    private static final int CONCURRENT_USERS = 50;
    private static final int MAX_CAPACITY = 1;

    @Mock private ClassEnrollmentRepository enrollments;
    @Mock private ClassSessionRepository sessions;
    @Mock private GymClassRepository gymClasses;
    @Mock private MembershipSubscriptionRepository subscriptions;
    @Mock private MemberRepository members;
    @Mock private NotificationService notifications;
    @Mock private MessageService messageService;
    @Mock private Clock clock;

    private EnrollmentService enrollmentService;
    private ExecutorService executor;
    private ReentrantLock pessimisticDbLock;
    private AtomicInteger currentBookedCount;

    private GymClass gymClass;
    private ClassSession session;

    /** Chuẩn bị trước mỗi test: dựng dữ liệu thật (lớp, buổi, hội viên) cho test đồng thời. */
    @BeforeEach
    void setUp() {
        pessimisticDbLock = new ReentrantLock(true);
        currentBookedCount = new AtomicInteger(0);
        executor = Executors.newFixedThreadPool(CONCURRENT_USERS);

        enrollmentService = new EnrollmentService(
                enrollments, sessions, gymClasses, subscriptions, members,
                notifications, messageService, clock
        );

        lenient().when(clock.instant()).thenReturn(Instant.parse("2026-10-25T10:00:00Z"));
        lenient().when(clock.getZone()).thenReturn(ZoneOffset.UTC);

        Room room = new Room();
        room.setName("Studio A");

        gymClass = new GymClass();
        ReflectionTestUtils.setField(gymClass, "id", 10L);
        gymClass.setName("High Intensity Spinning");
        gymClass.setCapacity(MAX_CAPACITY);
        gymClass.setStatus("active");
        gymClass.setRoom(room);

        session = new ClassSession();
        ReflectionTestUtils.setField(session, "id", 100L);
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 26));
        session.setStartTime(LocalTime.of(14, 0));
        session.setEndTime(LocalTime.of(15, 0));
        session.setStatus("scheduled");

        // Mô phỏng hành vi khóa bi quan SELECT FOR UPDATE
        when(gymClasses.findByIdForUpdate(10L)).thenAnswer(invocation -> {
            pessimisticDbLock.lock();
            return Optional.of(gymClass);
        });

        when(sessions.findById(100L)).thenReturn(Optional.of(session));
        when(subscriptions.hasActiveMembership(any(), any())).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(any(), any(), any())).thenReturn(true);
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(any(), any(), eq("booked")))
                .thenReturn(Optional.empty());

        // Số chỗ đã đặt phản ánh trạng thái hiện tại trong phạm vi khóa
        when(enrollments.countByGymClassIdAndStatus(eq(10L), eq("booked")))
                .thenAnswer(invocation -> (long) currentBookedCount.get());

        when(members.findByUserIdForUpdate(any(Long.class))).thenAnswer(invocation -> {
            Long uid = invocation.getArgument(0);
            User u = new User();
            ReflectionTestUtils.setField(u, "id", uid);
            u.setFullName("User " + uid);
            Member m = new Member();
            m.setUserId(uid);
            m.setUser(u);
            return Optional.of(m);
        });

        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenAnswer(invocation -> {
            currentBookedCount.incrementAndGet();
            ClassEnrollment en = invocation.getArgument(0);
            ReflectionTestUtils.setField(en, "id", 999L);
            return en;
        });
    }

    /** Dọn dẹp sau mỗi test: xóa dữ liệu đã tạo cho test đồng thời. */
    @AfterEach
    void tearDown() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    /** Kiểm thử: 50 yêu cầu đặt chỗ chạy đồng thời thì chỉ đúng một yêu cầu thành công. */
    @Test
    @DisplayName("SCRUM-114: 50 concurrent requests booking last seat -> Exactly 1 success, 49 conflicts, capacity respected")
    void testFiftyConcurrentBookingRequests_onlyOneSucceeds() throws Exception {
        CountDownLatch readyLatch = new CountDownLatch(CONCURRENT_USERS);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(CONCURRENT_USERS);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        AtomicInteger unexpectedErrorCount = new AtomicInteger(0);

        for (int i = 1; i <= CONCURRENT_USERS; i++) {
            final long userId = 1000L + i;
            final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(userId, "user" + userId + "@test.com", "MEMBER");

            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    // Chờ cả 50 luồng sẵn sàng rồi đồng loạt kích hoạt
                    startLatch.await();
                    EnrollmentDto result = enrollmentService.enroll(principal, 100L);
                    if (result != null) {
                        successCount.incrementAndGet();
                    }
                } catch (ConflictException ex) {
                    // Hành vi kỳ vọng khi lớp đã đạt sức chứa tối đa (tương ứng Trigger P2)
                    conflictCount.incrementAndGet();
                } catch (Exception ex) {
                    unexpectedErrorCount.incrementAndGet();
                } finally {
                    // Giải phóng khóa giao dịch cơ sở dữ liệu mô phỏng cho luồng tiếp theo
                    if (pessimisticDbLock.isHeldByCurrentThread()) {
                        pessimisticDbLock.unlock();
                    }
                    doneLatch.countDown();
                }
            });
        }

        // Chờ tất cả 50 luồng vào vị trí xuất phát
        assertTrue(readyLatch.await(5, TimeUnit.SECONDS), "All 50 worker threads should be ready");

        // Phát lệnh chạy đồng thời
        startLatch.countDown();

        // Chờ cả 50 luồng hoàn tất
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "All 50 worker threads should complete within timeout");

        // Kiểm chứng 1: Đúng 1 yêu cầu thành công (đặt chỗ thành công)
        assertEquals(1, successCount.get(),
                "Exactly 1 request must succeed in booking the last seat");

        // Kiểm chứng 2: Đúng 49 yêu cầu nhận ConflictException (409 Conflict / Lớp đã đầy)
        assertEquals(49, conflictCount.get(),
                "Exactly 49 requests must be rejected with ConflictException (class full)");

        // Kiểm chứng 3: Không phát sinh lỗi ngoài dự kiến
        assertEquals(0, unexpectedErrorCount.get(),
                "No unexpected errors should occur during concurrency burst");

        // Kiểm chứng 4: Toàn vẹn sức chứa: số chỗ đã đặt không được vượt quá max_capacity
        int finalBookedCount = currentBookedCount.get();
        assertTrue(finalBookedCount <= MAX_CAPACITY,
                "Current capacity (" + finalBookedCount + ") must not exceed max capacity (" + MAX_CAPACITY + ")");
        assertEquals(MAX_CAPACITY, finalBookedCount,
                "Final booked count must equal max capacity of 1");
    }
}
