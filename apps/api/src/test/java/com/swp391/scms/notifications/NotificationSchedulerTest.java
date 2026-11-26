package com.swp391.scms.notifications;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho job nền NotificationScheduler (notification scheduler). */
@ExtendWith(MockitoExtension.class)
class NotificationSchedulerTest {

    @Mock
    private MembershipSubscriptionRepository subscriptionRepository;

    @Mock
    private ClassSessionRepository sessionRepository;

    @Mock
    private ClassEnrollmentRepository enrollmentRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private MessageService messageService;

    @InjectMocks
    private NotificationScheduler notificationScheduler;

    private User user1;
    private User user2;
    private Member member1;
    private Member member2;
    private MembershipPackage membershipPackage;

    /** Chuẩn bị trước mỗi test: tạo NotificationScheduler với repository giả lập. */
    @BeforeEach
    void setUp() {
        user1 = new User();
        user1.setId(101L);
        user1.setFullName("Nguyễn Văn A");

        user2 = new User();
        user2.setId(102L);
        user2.setFullName("Trần Thị B");

        member1 = new Member();
        member1.setUserId(101L);
        member1.setUser(user1);

        member2 = new Member();
        member2.setUserId(102L);
        member2.setUser(user2);

        membershipPackage = new MembershipPackage();
        membershipPackage.setId(1L);
        membershipPackage.setName("Gói Platinum 12 Tháng");
    }

    // =========================================================================
    // Tác vụ 1: Kiểm thử thông báo hết hạn gói hội viên
    // =========================================================================

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Gói tập sắp hết hạn|Gói tập Platinum sắp hết hạn",
            "Membership package expiring soon|Your membership package \"Gold 1 Month\" will expire on 29/10/2026 (in 7 days). Please renew to continue using our services."
    })
    /** Kiểm thử: quét và thông báo gói sắp hết hạn thành công. */
    @DisplayName("Job 1: Sends package_expiry notification when subscription expires in 7 days")
    void scanAndNotifyExpiringSubscriptions_Success(String resolvedTitle, String resolvedBody) {
        LocalDate targetDate = LocalDate.of(2026, 10, 29);

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setId(201L);
        subscription.setMember(member1);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setEndDate(targetDate);
        subscription.setStatus("active");

        when(subscriptionRepository.findActiveSubscriptionsExpiringOn(targetDate))
                .thenReturn(List.of(subscription));
        when(notificationRepository.existsNotification(101L, "package_expiry", "membership_subscription", 201L))
                .thenReturn(false);
        when(messageService.getMessage(eq("notifications.package_expiry.title"), any(Object[].class)))
                .thenReturn(resolvedTitle);
        when(messageService.getMessage(eq("notifications.package_expiry.body"), any(Object[].class)))
                .thenReturn(resolvedBody);

        int sentCount = notificationScheduler.scanAndNotifyExpiringSubscriptions(targetDate);

        assertThat(sentCount).isEqualTo(1);
        verify(notificationService).send(
                eq(101L),
                eq(resolvedTitle),
                eq(resolvedBody),
                eq("package_expiry"),
                eq("membership_subscription"),
                eq(201L)
        );
    }

    /** Kiểm thử: bỏ qua gói đã được thông báo. */
    @Test
    @DisplayName("Job 1: Skips notification if already sent (Idempotency)")
    void scanAndNotifyExpiringSubscriptions_AlreadySent_Skips() {
        LocalDate targetDate = LocalDate.of(2026, 10, 29);

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setId(201L);
        subscription.setMember(member1);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setEndDate(targetDate);
        subscription.setStatus("active");

        when(subscriptionRepository.findActiveSubscriptionsExpiringOn(targetDate))
                .thenReturn(List.of(subscription));
        when(notificationRepository.existsNotification(101L, "package_expiry", "membership_subscription", 201L))
                .thenReturn(true);

        int sentCount = notificationScheduler.scanAndNotifyExpiringSubscriptions(targetDate);

        assertThat(sentCount).isEqualTo(0);
        verify(notificationService, never()).send(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /** Kiểm thử: không có dữ liệu thì trả 0. */
    @Test
    @DisplayName("Job 1: Returns 0 when no subscriptions are expiring on target date")
    void scanAndNotifyExpiringSubscriptions_NoData_ReturnsZero() {
        LocalDate targetDate = LocalDate.of(2026, 10, 29);

        when(subscriptionRepository.findActiveSubscriptionsExpiringOn(targetDate))
                .thenReturn(Collections.emptyList());

        int sentCount = notificationScheduler.scanAndNotifyExpiringSubscriptions(targetDate);

        assertThat(sentCount).isEqualTo(0);
        verify(notificationService, never()).send(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /** Kiểm thử: job hết hạn gói chạy đúng. */
    @Test
    @DisplayName("Job 1: schedulePackageExpiryJob executes properly at 08:00")
    void schedulePackageExpiryJob_ExecutesProperly() {
        when(subscriptionRepository.findActiveSubscriptionsExpiringOn(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        notificationScheduler.schedulePackageExpiryJob();

        verify(subscriptionRepository).findActiveSubscriptionsExpiringOn(any(LocalDate.class));
    }

    // =========================================================================
    // Tác vụ 2: Kiểm thử nhắc nhở lớp học sắp diễn ra
    // =========================================================================

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Nhắc nhở lịch học|Lớp học sắp bắt đầu",
            "Upcoming class reminder|Your class \"Yoga Vinyasa\" is starting at 11:00 on 22/10/2026. Get ready!"
    })
    /** Kiểm thử: quét và nhắc các buổi học sắp tới thành công. */
    @DisplayName("Job 2: Sends class_reminder notification for booked members within 2 hours")
    void scanAndNotifyUpcomingClasses_Success(String resolvedTitle, String resolvedBody) {
        LocalDateTime referenceTime = LocalDateTime.of(2026, 10, 22, 10, 0); // 10:00
        LocalDate sessionDate = LocalDate.of(2026, 10, 22);
        LocalTime startTime = LocalTime.of(11, 0); // 11:00 (sau 1 giờ, nằm trong khung 2 giờ)
        LocalTime endTime = LocalTime.of(12, 0);

        GymClass gymClass = new GymClass();
        gymClass.setId(10L);
        gymClass.setName("Yoga Vinyasa");

        ClassSession session = new ClassSession();
        session.setId(301L);
        session.setGymClass(gymClass);
        session.setSessionDate(sessionDate);
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setStatus("scheduled");

        ClassEnrollment enrollment1 = new ClassEnrollment();
        enrollment1.setId(401L);
        enrollment1.setGymClass(gymClass);
        enrollment1.setMember(member1);
        enrollment1.setStatus("booked");

        ClassEnrollment enrollment2 = new ClassEnrollment();
        enrollment2.setId(402L);
        enrollment2.setGymClass(gymClass);
        enrollment2.setMember(member2);
        enrollment2.setStatus("booked");

        when(sessionRepository.findScheduledSessionsBetweenDates(sessionDate, sessionDate))
                .thenReturn(List.of(session));
        when(enrollmentRepository.findByGymClassIdAndStatus(10L, "booked"))
                .thenReturn(List.of(enrollment1, enrollment2));

        when(notificationRepository.existsNotification(101L, "class_reminder", "class_session", 301L))
                .thenReturn(false);
        when(notificationRepository.existsNotification(102L, "class_reminder", "class_session", 301L))
                .thenReturn(false);

        when(messageService.getMessage(eq("notifications.class_reminder.title"), any(Object[].class)))
                .thenReturn(resolvedTitle);
        when(messageService.getMessage(eq("notifications.class_reminder.body"), any(Object[].class)))
                .thenReturn(resolvedBody);

        int sentCount = notificationScheduler.scanAndNotifyUpcomingClasses(referenceTime);

        assertThat(sentCount).isEqualTo(2);
        verify(notificationService).send(eq(101L), eq(resolvedTitle), eq(resolvedBody), eq("class_reminder"), eq("class_session"), eq(301L));
        verify(notificationService).send(eq(102L), eq(resolvedTitle), eq(resolvedBody), eq("class_reminder"), eq("class_session"), eq(301L));
    }

    /** Kiểm thử: bỏ qua buổi đã nhắc. */
    @Test
    @DisplayName("Job 2: Skips members who already received class_reminder (Idempotency)")
    void scanAndNotifyUpcomingClasses_AlreadySent_Skips() {
        LocalDateTime referenceTime = LocalDateTime.of(2026, 10, 22, 10, 0);
        LocalDate sessionDate = LocalDate.of(2026, 10, 22);

        GymClass gymClass = new GymClass();
        gymClass.setId(10L);
        gymClass.setName("Cardio HIIT");

        ClassSession session = new ClassSession();
        session.setId(301L);
        session.setGymClass(gymClass);
        session.setSessionDate(sessionDate);
        session.setStartTime(LocalTime.of(11, 30));
        session.setEndTime(LocalTime.of(12, 30));
        session.setStatus("scheduled");

        ClassEnrollment enrollment1 = new ClassEnrollment();
        enrollment1.setId(401L);
        enrollment1.setGymClass(gymClass);
        enrollment1.setMember(member1);
        enrollment1.setStatus("booked");

        when(sessionRepository.findScheduledSessionsBetweenDates(sessionDate, sessionDate))
                .thenReturn(List.of(session));
        when(enrollmentRepository.findByGymClassIdAndStatus(10L, "booked"))
                .thenReturn(List.of(enrollment1));

        // Đã gửi trước đó
        when(notificationRepository.existsNotification(101L, "class_reminder", "class_session", 301L))
                .thenReturn(true);

        int sentCount = notificationScheduler.scanAndNotifyUpcomingClasses(referenceTime);

        assertThat(sentCount).isEqualTo(0);
        verify(notificationService, never()).send(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /** Kiểm thử: bỏ qua buổi cách hơn hai giờ. */
    @Test
    @DisplayName("Job 2: Ignores class sessions starting after 2 hours")
    void scanAndNotifyUpcomingClasses_AfterTwoHours_Ignored() {
        LocalDateTime referenceTime = LocalDateTime.of(2026, 10, 22, 10, 0);
        LocalDate sessionDate = LocalDate.of(2026, 10, 22);

        GymClass gymClass = new GymClass();
        gymClass.setId(10L);

        ClassSession session = new ClassSession();
        session.setId(301L);
        session.setGymClass(gymClass);
        session.setSessionDate(sessionDate);
        session.setStartTime(LocalTime.of(13, 0)); // sau 3 giờ (> khung 2 giờ)
        session.setEndTime(LocalTime.of(14, 0));
        session.setStatus("scheduled");

        when(sessionRepository.findScheduledSessionsBetweenDates(sessionDate, sessionDate))
                .thenReturn(List.of(session));

        int sentCount = notificationScheduler.scanAndNotifyUpcomingClasses(referenceTime);

        assertThat(sentCount).isEqualTo(0);
        verify(enrollmentRepository, never()).findByGymClassIdAndStatus(anyLong(), anyString());
        verify(notificationService, never()).send(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /** Kiểm thử: bỏ qua buổi đã qua. */
    @Test
    @DisplayName("Job 2: Ignores class sessions in the past")
    void scanAndNotifyUpcomingClasses_InThePast_Ignored() {
        LocalDateTime referenceTime = LocalDateTime.of(2026, 10, 22, 10, 0);
        LocalDate sessionDate = LocalDate.of(2026, 10, 22);

        GymClass gymClass = new GymClass();
        gymClass.setId(10L);

        ClassSession session = new ClassSession();
        session.setId(301L);
        session.setGymClass(gymClass);
        session.setSessionDate(sessionDate);
        session.setStartTime(LocalTime.of(9, 0)); // cách đây 1 giờ
        session.setEndTime(LocalTime.of(10, 0));
        session.setStatus("scheduled");

        when(sessionRepository.findScheduledSessionsBetweenDates(sessionDate, sessionDate))
                .thenReturn(List.of(session));

        int sentCount = notificationScheduler.scanAndNotifyUpcomingClasses(referenceTime);

        assertThat(sentCount).isEqualTo(0);
        verify(enrollmentRepository, never()).findByGymClassIdAndStatus(anyLong(), anyString());
        verify(notificationService, never()).send(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /** Kiểm thử: job nhắc lớp học chạy đúng. */
    @Test
    @DisplayName("Job 2: scheduleClassReminderJob executes properly every 30 minutes")
    void scheduleClassReminderJob_ExecutesProperly() {
        org.springframework.test.util.ReflectionTestUtils.setField(notificationScheduler, "classesEnabled", true);
        when(sessionRepository.findScheduledSessionsBetweenDates(any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        notificationScheduler.scheduleClassReminderJob();

        verify(sessionRepository).findScheduledSessionsBetweenDates(any(LocalDate.class), any(LocalDate.class));
    }

    /** Kiểm thử: job nhắc lớp bị bỏ qua khi tính năng lớp đã tắt. */
    @Test
    @DisplayName("Job 2 does nothing while group classes are out of scope")
    void scheduleClassReminderJob_SkipsWhenClassesDisabled() {
        notificationScheduler.scheduleClassReminderJob();

        verify(sessionRepository, never()).findScheduledSessionsBetweenDates(any(LocalDate.class), any(LocalDate.class));
    }

    /** Kiểm thử P1-BE-49: bỏ qua user đã xóa mềm và không dừng cả batch khi một người nhận ném ResourceNotFoundException. */
    @Test
    @DisplayName("P1-BE-49: Expiring subscription batch skips soft-deleted users and continues on ResourceNotFoundException")
    void scanAndNotifyExpiringSubscriptions_SkipsSoftDeletedAndContinuesBatch() {
        LocalDate targetDate = LocalDate.of(2026, 10, 29);

        user1.setDeletedAt(LocalDateTime.now().minusDays(1)); // soft-deleted
        User user3 = new User();
        user3.setId(103L);
        Member member3 = new Member();
        member3.setUserId(103L);
        member3.setUser(user3);

        MembershipSubscription subDeleted = new MembershipSubscription();
        subDeleted.setId(201L);
        subDeleted.setMember(member1);
        subDeleted.setMembershipPackage(membershipPackage);
        subDeleted.setEndDate(targetDate);

        MembershipSubscription subRaceDeleted = new MembershipSubscription();
        subRaceDeleted.setId(202L);
        subRaceDeleted.setMember(member2);
        subRaceDeleted.setMembershipPackage(membershipPackage);
        subRaceDeleted.setEndDate(targetDate);

        MembershipSubscription subValid = new MembershipSubscription();
        subValid.setId(203L);
        subValid.setMember(member3);
        subValid.setMembershipPackage(membershipPackage);
        subValid.setEndDate(targetDate);

        when(subscriptionRepository.findActiveSubscriptionsExpiringOn(targetDate))
                .thenReturn(List.of(subDeleted, subRaceDeleted, subValid));
        when(notificationRepository.existsNotification(anyLong(), eq("package_expiry"), eq("membership_subscription"), anyLong()))
                .thenReturn(false);
        doThrow(new com.swp391.scms.common.exception.ResourceNotFoundException("resource.user", 102L))
                .when(notificationService).send(eq(102L), anyString(), anyString(), eq("package_expiry"), eq("membership_subscription"), eq(202L));

        int sentCount = notificationScheduler.scanAndNotifyExpiringSubscriptions(targetDate);

        assertThat(sentCount).isEqualTo(1);
        verify(notificationService, never()).send(eq(101L), any(), any(), any(), any(), any());
        verify(notificationService).send(eq(103L), anyString(), anyString(), eq("package_expiry"), eq("membership_subscription"), eq(203L));
    }

    /** Kiểm thử P1-BE-49 & P2-BE-55: bỏ qua lớp inactive, user xóa mềm và không dừng batch khi một học viên ném ResourceNotFoundException. */
    @Test
    @DisplayName("P1-BE-49 & P2-BE-55: Class reminder skips inactive classes, soft-deleted users, and continues batch on 404")
    void scanAndNotifyUpcomingClasses_SkipsInactiveClassAndSoftDeletedUsers() {
        LocalDateTime referenceTime = LocalDateTime.of(2026, 10, 22, 10, 0);
        LocalDate sessionDate = LocalDate.of(2026, 10, 22);

        GymClass inactiveClass = new GymClass();
        inactiveClass.setId(9L);
        inactiveClass.setName("Lớp đã ngưng");
        inactiveClass.setStatus("inactive");
        ClassSession inactiveSession = new ClassSession();
        inactiveSession.setId(300L);
        inactiveSession.setGymClass(inactiveClass);
        inactiveSession.setSessionDate(sessionDate);
        inactiveSession.setStartTime(LocalTime.of(11, 0));
        inactiveSession.setStatus("scheduled");

        GymClass activeClass = new GymClass();
        activeClass.setId(10L);
        activeClass.setName("Yoga Flow");
        activeClass.setStatus("active");
        ClassSession activeSession = new ClassSession();
        activeSession.setId(301L);
        activeSession.setGymClass(activeClass);
        activeSession.setSessionDate(sessionDate);
        activeSession.setStartTime(LocalTime.of(11, 0));
        activeSession.setStatus("scheduled");

        user1.setDeletedAt(LocalDateTime.now().minusDays(2));
        User user3 = new User();
        user3.setId(103L);
        Member member3 = new Member();
        member3.setUserId(103L);
        member3.setUser(user3);

        ClassEnrollment e1 = new ClassEnrollment(); e1.setMember(member1); e1.setStatus("booked");
        ClassEnrollment e2 = new ClassEnrollment(); e2.setMember(member2); e2.setStatus("booked");
        ClassEnrollment e3 = new ClassEnrollment(); e3.setMember(member3); e3.setStatus("booked");

        when(sessionRepository.findScheduledSessionsBetweenDates(sessionDate, sessionDate))
                .thenReturn(List.of(inactiveSession, activeSession));
        when(enrollmentRepository.findByGymClassIdAndStatus(10L, "booked"))
                .thenReturn(List.of(e1, e2, e3));
        when(notificationRepository.existsNotification(anyLong(), eq("class_reminder"), eq("class_session"), eq(301L)))
                .thenReturn(false);
        doThrow(new com.swp391.scms.common.exception.ResourceNotFoundException("resource.user", 102L))
                .when(notificationService).send(eq(102L), anyString(), anyString(), eq("class_reminder"), eq("class_session"), eq(301L));

        int sentCount = notificationScheduler.scanAndNotifyUpcomingClasses(referenceTime);

        assertThat(sentCount).isEqualTo(1);
        verify(enrollmentRepository, never()).findByGymClassIdAndStatus(eq(9L), anyString());
        verify(notificationService, never()).send(eq(101L), any(), any(), any(), any(), any());
        verify(notificationService).send(eq(103L), anyString(), anyString(), eq("class_reminder"), eq("class_session"), eq(301L));
    }

    /** Kiểm thử P2-BE-50: job hết hạn gói chạy theo múi giờ Asia/Ho_Chi_Minh. */
    @Test
    @DisplayName("P2-BE-50: schedulePackageExpiryJob uses Asia/Ho_Chi_Minh timezone")
    void schedulePackageExpiryJob_UsesVietnamTimezone() throws NoSuchMethodException {
        var scheduled = NotificationScheduler.class.getMethod("schedulePackageExpiryJob")
                .getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
        assertThat(scheduled).isNotNull();
        assertThat(scheduled.zone()).isEqualTo("Asia/Ho_Chi_Minh");
    }

    /** Kiểm thử: Spring context phân giải được constructor autowired. */
    @Test
    @DisplayName("Spring context verifies Autowired constructor exists and bean instantiates without NoSuchMethodException")
    void springContextResolvesAutowiredConstructor() {
        org.springframework.context.annotation.AnnotationConfigApplicationContext context =
                new org.springframework.context.annotation.AnnotationConfigApplicationContext();
        context.getDefaultListableBeanFactory().registerSingleton("subscriptionRepository", subscriptionRepository);
        context.getDefaultListableBeanFactory().registerSingleton("sessionRepository", sessionRepository);
        context.getDefaultListableBeanFactory().registerSingleton("enrollmentRepository", enrollmentRepository);
        context.getDefaultListableBeanFactory().registerSingleton("notificationRepository", notificationRepository);
        context.getDefaultListableBeanFactory().registerSingleton("notificationService", notificationService);
        context.getDefaultListableBeanFactory().registerSingleton("messageService", messageService);
        context.register(NotificationScheduler.class);
        context.refresh();

        NotificationScheduler bean = context.getBean(NotificationScheduler.class);
        assertThat(bean).isNotNull();
        context.close();
    }
}
