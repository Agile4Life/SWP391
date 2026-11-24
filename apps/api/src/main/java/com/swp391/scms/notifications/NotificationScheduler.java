package com.swp391.scms.notifications;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Trình lập lịch nền cho các thông báo hệ thống tự động (SCRUM-107):
 * - Job 1: Quét hằng ngày lúc 08:00 sáng các gói hội viên sắp hết hạn trong đúng 7 ngày.
 * - Job 2: Quét định kỳ mỗi 30 phút các buổi lớp học sắp bắt đầu trong vòng 2 giờ tới (tính năng cũ, chỉ chạy
 *   khi bật cờ lớp nhóm).
 */
@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final MembershipSubscriptionRepository subscriptionRepository;
    private final ClassSessionRepository sessionRepository;
    private final ClassEnrollmentRepository enrollmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final Clock clock;
    /** Lớp học nhóm nằm ngoài phạm vi; nhắc lịch cũng tắt theo để không gửi thông báo cho các buổi cũ. */
    @org.springframework.beans.factory.annotation.Value("${app.legacy.classes-enabled:false}")
    private boolean classesEnabled;

    /** Constructor Spring dùng; MessageService và Clock là tùy chọn. */
    @Autowired
    public NotificationScheduler(
            MembershipSubscriptionRepository subscriptionRepository,
            ClassSessionRepository sessionRepository,
            ClassEnrollmentRepository enrollmentRepository,
            NotificationRepository notificationRepository,
            NotificationService notificationService,
            @Autowired(required = false) MessageService messageService,
            @Autowired(required = false) Clock clock
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.notificationRepository = notificationRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /** Constructor cho test không có MessageService. */
    public NotificationScheduler(
            MembershipSubscriptionRepository subscriptionRepository,
            ClassSessionRepository sessionRepository,
            ClassEnrollmentRepository enrollmentRepository,
            NotificationRepository notificationRepository,
            NotificationService notificationService,
            MessageService messageService
    ) {
        this(subscriptionRepository, sessionRepository, enrollmentRepository, notificationRepository, notificationService, messageService, null);
    }

    /** Constructor cho test có thêm repository đặt buổi. */
    public NotificationScheduler(
            MembershipSubscriptionRepository subscriptionRepository,
            ClassSessionRepository sessionRepository,
            ClassEnrollmentRepository enrollmentRepository,
            NotificationRepository notificationRepository,
            NotificationService notificationService
    ) {
        this(subscriptionRepository, sessionRepository, enrollmentRepository, notificationRepository, notificationService, null, null);
    }

    /**
     * Job 1 (Hết hạn gói): Chạy lúc 08:00 sáng mỗi ngày.
     * Quét các membership_subscriptions có end_date còn đúng 7 ngày; tạo notification package_expiry.
     */
    // Hàm quét bên dưới được gọi trực tiếp trên this (bỏ qua proxy), nên hàm job giữ transaction.
    @Scheduled(cron = "${app.scheduler.package-expiry.cron:0 0 8 * * ?}")
    @Transactional
    public void schedulePackageExpiryJob() {
        log.info("[NotificationScheduler] Running daily package expiry reminder job...");
        LocalDate targetDate = LocalDate.now(clock).plusDays(7);
        int sentCount = scanAndNotifyExpiringSubscriptions(targetDate);
        log.info("[NotificationScheduler] Finished package expiry job. Sent {} notification(s).", sentCount);
    }

    /**
     * Nghiệp vụ quét các kỳ gói active hết hạn đúng ngày đích và gửi nhắc gia hạn; bỏ qua hội viên đã trả tiền
     * kỳ tiếp theo và kỳ đã được nhắc rồi.
     *
     * @param targetDate ngày hết hạn cần quét (thường là LocalDate.now().plusDays(7))
     * @return số thông báo đã gửi
     */
    @Transactional
    public int scanAndNotifyExpiringSubscriptions(LocalDate targetDate) {
        if (targetDate == null) {
            targetDate = LocalDate.now(clock).plusDays(7);
        }

        List<MembershipSubscription> expiringSubscriptions =
                subscriptionRepository.findActiveSubscriptionsExpiringOn(targetDate);

        int sentCount = 0;
        for (MembershipSubscription sub : expiringSubscriptions) {
            if (sub.getMember() == null || sub.getMember().getUserId() == null) {
                continue;
            }
            Long userId = sub.getMember().getUserId();
            // Hội viên đã thanh toán kỳ tiếp theo thì không bị sắp hết hạn.
            if (subscriptionRepository.existsByPreviousSubscriptionIdAndStatusIn(sub.getId(), java.util.List.of("active", "expired"))) {
                continue;
            }

            // Kiểm tra idempotency: tránh gửi trùng thông báo cho cùng một kỳ gói
            boolean alreadySent = notificationRepository.existsNotification(
                    userId,
                    "package_expiry",
                    "membership_subscription",
                    sub.getId()
            );

            if (alreadySent) {
                continue;
            }

            String packageName = (sub.getMembershipPackage() != null && sub.getMembershipPackage().getName() != null)
                    ? sub.getMembershipPackage().getName()
                    : "Gói tập";
            String expiryDateStr = sub.getEndDate() != null ? sub.getEndDate().format(DATE_FORMATTER) : "";

            String title = resolveMessage("notifications.package_expiry.title", "Gói tập sắp hết hạn");
            String message = resolveMessage("notifications.package_expiry.body",
                    "Gói tập \"" + packageName + "\" của bạn sẽ hết hạn vào ngày " + expiryDateStr + " (còn 7 ngày). Vui lòng gia hạn để tiếp tục sử dụng dịch vụ.",
                    packageName,
                    expiryDateStr
            );

            notificationService.send(
                    userId,
                    title,
                    message,
                    "package_expiry",
                    "membership_subscription",
                    sub.getId()
            );
            sentCount++;
        }
        return sentCount;
    }

    /**
     * Job 2 (Nhắc lịch học): Chạy mỗi 30 phút.
     * Quét các class_sessions diễn ra trong vòng 2 giờ tới; gửi notification class_reminder cho toàn bộ hội viên có enrollment booked.
     */
    @Scheduled(cron = "${app.scheduler.class-reminder.cron:0 */30 * * * ?}")
    @Transactional
    public void scheduleClassReminderJob() {
        if (!classesEnabled) return;
        log.info("[NotificationScheduler] Running class reminder job...");
        LocalDateTime now = LocalDateTime.now(clock);
        int sentCount = scanAndNotifyUpcomingClasses(now);
        log.info("[NotificationScheduler] Finished class reminder job. Sent {} notification(s).", sentCount);
    }

    /**
     * Nghiệp vụ quét các buổi lớp sắp diễn ra trong 2 giờ tới và gửi nhắc cho hội viên đã đăng ký (mỗi buổi
     * chỉ nhắc một lần).
     *
     * @param referenceTime mốc thời gian tham chiếu hiện tại
     * @return số thông báo nhắc lịch đã gửi
     */
    @Transactional
    public int scanAndNotifyUpcomingClasses(LocalDateTime referenceTime) {
        if (referenceTime == null) {
            referenceTime = LocalDateTime.now(clock);
        }

        LocalDateTime twoHoursLater = referenceTime.plusHours(2);
        LocalDate startDate = referenceTime.toLocalDate();
        LocalDate endDate = twoHoursLater.toLocalDate();

        List<ClassSession> candidates = sessionRepository.findScheduledSessionsBetweenDates(startDate, endDate);

        int sentCount = 0;
        for (ClassSession session : candidates) {
            if (session.getSessionDate() == null || session.getStartTime() == null) {
                continue;
            }

            LocalDateTime sessionStart = LocalDateTime.of(session.getSessionDate(), session.getStartTime());
            if (sessionStart.isBefore(referenceTime) || sessionStart.isAfter(twoHoursLater)) {
                continue;
            }

            if (session.getGymClass() == null || session.getGymClass().getId() == null) {
                continue;
            }

            Long gymClassId = session.getGymClass().getId();
            List<ClassEnrollment> enrollments = enrollmentRepository.findByGymClassIdAndStatus(gymClassId, "booked");

            String className = (session.getGymClass().getName() != null)
                    ? session.getGymClass().getName()
                    : "Lớp học";
            String startTimeStr = session.getStartTime().format(TIME_FORMATTER);
            String sessionDateStr = session.getSessionDate().format(DATE_FORMATTER);

            String title = resolveMessage("notifications.class_reminder.title", "Nhắc nhở lịch học sắp diễn ra");
            String message = resolveMessage("notifications.class_reminder.body",
                    "Lớp học \"" + className + "\" của bạn sẽ bắt đầu lúc " + startTimeStr + " ngày " + sessionDateStr + ". Hãy chuẩn bị sẵn sàng!",
                    className,
                    startTimeStr,
                    sessionDateStr
            );

            java.util.Set<Long> recipients = new java.util.LinkedHashSet<>();
            for (ClassEnrollment enrollment : enrollments) {
                if (enrollment.getMember() != null && enrollment.getMember().getUserId() != null) {
                    recipients.add(enrollment.getMember().getUserId());
                }
            }
            if (sessionBookings != null) {
                for (com.swp391.scms.scheduling.entity.SessionBooking booking : sessionBookings.findBySessionIdAndStatus(session.getId(), "booked")) {
                    if (booking.getMember() != null && booking.getMember().getUserId() != null) {
                        recipients.add(booking.getMember().getUserId());
                    }
                }
            }

            for (Long userId : recipients) {

                // Kiểm tra idempotency: không gửi lại nhắc lịch lớp học cho cùng buổi học tới cùng người dùng
                boolean alreadySent = notificationRepository.existsNotification(
                        userId,
                        "class_reminder",
                        "class_session",
                        session.getId()
                );

                if (alreadySent) {
                    continue;
                }

                notificationService.send(
                        userId,
                        title,
                        message,
                        "class_reminder",
                        "class_session",
                        session.getId()
                );
                sentCount++;
            }
        }
        return sentCount;
    }

    /** Dịch mã thông báo; không dịch được thì dùng câu dự phòng. */
    private String resolveMessage(String code, String fallback, Object... args) {
        if (messageService == null) {
            return fallback;
        }
        try {
            String resolved = messageService.getMessage(code, args);
            return (resolved != null && !resolved.equals(code)) ? resolved : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }
}


