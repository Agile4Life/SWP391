package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.membership.service.MemberDiscountService;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.QuotaDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.CourseCheckoutDto;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Stream;
import java.util.Objects;

/**
 * SCRUM-73 & SCRUM-132: member class booking, time-overlap guard, and cancellation.
 *
 * <p>Invariant triggers are owned by the database and are never bypassed:
 * Trigger P2 ({@code trg_enrollments_check_capacity}) rejects a full class and
 * Trigger P4 ({@code trg_enrollments_check_membership}) rejects an inactive/expired
 * membership. Both are mirrored as a pre-check so the API returns a precise error
 * instead of a raw constraint violation.
 */
@Service
public class EnrollmentService {

    private static final String BOOKED = "booked";
    private static final String CANCELLED = "cancelled";

    private static final String ROLE_CENTER_MANAGER = "CENTER_MANAGER";
    private static final String ROLE_MANAGER = "MANAGER";
    private static final String ROLE_STAFF = "STAFF";
    private static final String ROLE_RECEPTIONIST = "RECEPTIONIST";

    private final ClassEnrollmentRepository enrollments;
    private final ClassSessionRepository sessions;
    private final GymClassRepository gymClasses;
    private final MembershipSubscriptionRepository subscriptions;
    private final MemberRepository members;
    private final NotificationService notifications;
    private final MessageService messageService;
    private final Clock clock;

    @Autowired(required = false)
    private com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings;

    @Autowired(required = false)
    private SessionBookingService sessionBookingService;

    @Autowired(required = false)
    private PaymentRepository paymentRepository;

    @Autowired(required = false)
    private MemberScheduleGuard scheduleGuard;

    @Autowired(required = false)
    private MemberDiscountService memberDiscounts;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.swp391.scms.wallet.WalletService wallets;

    /** Online (wallet/VNPay) course fees hold the seat this long; cash fees hold it until the course starts. */
    public static final long ONLINE_HOLD_MINUTES = 15;

    public void setMemberDiscounts(MemberDiscountService memberDiscounts) {
        this.memberDiscounts = memberDiscounts;
    }

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.swp391.scms.finance.service.VnpayPaymentService vnpayPaymentService;

    public void setPaymentRepository(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public void setVnpayPaymentService(com.swp391.scms.finance.service.VnpayPaymentService vnpayPaymentService) {
        this.vnpayPaymentService = vnpayPaymentService;
    }

    /** Blocks releasing a course fee while a VNPay attempt for it may still be settled by the gateway. */
    @Autowired(required = false)
    private com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    public void setVnpayGuard(com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard) {
        this.vnpayGuard = vnpayGuard;
    }

    @Autowired
    public EnrollmentService(ClassEnrollmentRepository enrollments,
                             ClassSessionRepository sessions,
                             GymClassRepository gymClasses,
                             MembershipSubscriptionRepository subscriptions,
                             MemberRepository members,
                             NotificationService notifications,
                             MessageService messageService,
                             Clock clock) {
        this.enrollments = enrollments;
        this.sessions = sessions;
        this.gymClasses = gymClasses;
        this.subscriptions = subscriptions;
        this.members = members;
        this.notifications = notifications;
        this.messageService = messageService;
        this.clock = clock;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Class-wide enrollment (legacy): holds one seat in every session of the class. New bookings are made per
     * session through {@link SessionBookingService}; this stays for existing enrollments and API clients.
     * Rejects overlapping bookings across different classes in the same time slot.
     */
    @Transactional
    public EnrollmentDto enroll(AuthenticatedPrincipal principal, Long sessionId) {
        Member member = lockMember(principal.id());
        ClassSession session = findSession(sessionId);
        Long classId = session.getGymClass().getId();
        GymClass gymClass = gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
        if (gymClass.getStatus() != null && !"active".equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_CLASS_INACTIVE",
                    "error.scheduling.class_inactive",
                    null,
                    "Class is currently inactive");
        }
        SessionEligibility.ensureBookable(session, clock);
        SessionEligibility.ensureMembershipCoversSession(subscriptions, member.getUserId(), session.getSessionDate(), clock);

        SessionEligibility.ensurePlatinumRoomAccess(subscriptions, member.getUserId(), gymClass.getRoom(), session.getSessionDate());

        if (enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), member.getUserId(), BOOKED)
                .isPresent()) {
            throw new ConflictException(
                    "SCHEDULING_ALREADY_ENROLLED",
                    "error.scheduling.already_enrolled",
                    null,
                    "Member already has an active booking for this class");
        }
        if (sessionBookings != null && sessionBookings.existsBySessionGymClassIdAndMemberUserIdAndStatus(
                classId, member.getUserId(), BOOKED)) {
            throw new ConflictException(
                    "SCHEDULING_ALREADY_ENROLLED",
                    "error.scheduling.already_enrolled",
                    null,
                    "Member already has per-session bookings in this class");
        }

        // SCRUM-132: Chặn Hội viên đặt các lịch học đè/chồng chéo giờ lên nhau
        ensureNoMemberScheduleOverlap(member.getUserId(), session, gymClass.getId());
        if (scheduleGuard != null) {
            scheduleGuard.ensureFree(member.getUserId(), session.getSessionDate(), session.getStartTime(), session.getEndTime(), gymClass.getId());
        }

        long booked = enrollments.countByGymClassIdAndStatus(gymClass.getId(), BOOKED) + busiestSession(gymClass.getId());
        if (booked >= gymClass.getCapacity()) {
            throw new ConflictException(
                    "SCHEDULING_CLASS_FULL",
                    "error.scheduling.class_full",
                    null,
                    "Class is full");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus(BOOKED);
        enrollment.setEnrolledAt(now);

        ClassEnrollment saved = enrollments.saveAndFlush(enrollment);

        notifications.send(member.getUserId(),
                msg("notifications.booking.enrolled.title"),
                msg("notifications.booking.enrolled.body", gymClass.getName(), session.getSessionDate().toString()),
                "system",
                "class_enrollment",
                saved.getId());

        return toDto(saved, session);
    }

    /**
     * SCRUM-132: Rejects a booking if the member already holds an active booking in another class
     * whose scheduled session overlaps in time.
     */
    public void ensureNoMemberScheduleOverlap(Long memberId, ClassSession targetSession, Long excludeClassId) {
        if (memberId == null || targetSession == null
                || targetSession.getSessionDate() == null
                || targetSession.getStartTime() == null
                || targetSession.getEndTime() == null) {
            return;
        }
        LocalDate targetDate = targetSession.getSessionDate();
        LocalTime targetStart = targetSession.getStartTime();
        LocalTime targetEnd = targetSession.getEndTime();

        List<ClassEnrollment> memberEnrollments = enrollments.findByMemberUserId(memberId);
        if (memberEnrollments != null) {
            for (ClassEnrollment existing : memberEnrollments) {
                if (existing == null || !BOOKED.equalsIgnoreCase(existing.getStatus())) {
                    continue;
                }
                GymClass bookedClass = existing.getGymClass();
                if (bookedClass == null || bookedClass.getId() == null
                        || Objects.equals(bookedClass.getId(), excludeClassId)) {
                    continue;
                }
                List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(bookedClass.getId());
                if (classSessions == null) {
                    continue;
                }
                for (ClassSession s : classSessions) {
                    if (s == null || "cancelled".equalsIgnoreCase(s.getStatus())) {
                        continue;
                    }
                    if (targetDate.equals(s.getSessionDate())
                            && s.getStartTime() != null
                            && s.getEndTime() != null
                            && targetStart.isBefore(s.getEndTime())
                            && targetEnd.isAfter(s.getStartTime())) {
                        String rangeStart = formatTime(s.getStartTime());
                        String rangeEnd = formatTime(s.getEndTime());
                        throw new ConflictException(
                                "SCHEDULING_MEMBER_TIME_OVERLAP",
                                "error.scheduling.member_time_overlap",
                                new Object[]{bookedClass.getName(), targetDate.toString(), rangeStart, rangeEnd},
                                "Member already has an overlapping booking for class " + bookedClass.getName()
                                        + " on " + targetDate + " (" + rangeStart + " - " + rangeEnd + ")");
                    }
                }
            }
        }

        if (sessionBookings != null) {
            for (com.swp391.scms.scheduling.entity.SessionBooking booking : sessionBookings.findForMember(memberId, BOOKED, targetDate, targetDate)) {
                ClassSession s = booking.getSession();
                if (s == null || "cancelled".equalsIgnoreCase(s.getStatus())
                        || Objects.equals(s.getGymClass().getId(), excludeClassId)) {
                    continue;
                }
                if (targetStart.isBefore(s.getEndTime()) && targetEnd.isAfter(s.getStartTime())) {
                    throw new ConflictException(
                            "SCHEDULING_MEMBER_TIME_OVERLAP",
                            "error.scheduling.member_time_overlap",
                            new Object[]{s.getGymClass().getName(), targetDate.toString(),
                                    formatTime(s.getStartTime()), formatTime(s.getEndTime())},
                            "Member already has an overlapping per-session booking");
                }
            }
        }

    }

    /** Highest number of per-session bookings in any session of the class. */
    private long busiestSession(Long classId) {
        if (sessionBookings == null) return 0;
        return sessionBookings.countBookedGroupedBySession(classId).stream()
                .mapToLong(com.swp391.scms.scheduling.dto.SessionBookingCount::bookedCount).max().orElse(0);
    }

    private static String formatTime(LocalTime time) {
        if (time == null) return "";
        String raw = time.toString();
        return raw.length() >= 5 ? raw.substring(0, 5) : raw;
    }

    /**
     * SCRUM-73 BR-05: cancel a booking. Soft delete, releases the seat immediately.
     * Only the owner or Staff/Manager may cancel.
     */
    @Transactional
    public EnrollmentDto cancel(AuthenticatedPrincipal principal, Long enrollmentId) {
        Long classId = enrollments.findClassIdById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", enrollmentId));
        lockClass(classId);
        ClassEnrollment enrollment = enrollments.findByIdForUpdate(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", enrollmentId));

        boolean isStaff = isStaffRole(principal.role());
        boolean isOwner = enrollment.getMember() != null
                && enrollment.getMember().getUserId().equals(principal.id());
        if (!isStaff && !isOwner) {
            throw new ForbiddenException(
                    "SCHEDULING_ENROLLMENT_NOT_OWNER",
                    "error.scheduling.enrollment_not_owner",
                    null,
                    "Only the owner or staff may cancel this enrollment");
        }

        if (!BOOKED.equalsIgnoreCase(enrollment.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ENROLLMENT_NOT_BOOKED",
                    "error.scheduling.enrollment_not_booked",
                    null,
                    "Only a booked enrollment can be cancelled");
        }

        // A member cannot walk away from a course that has started (the credit would come back and the fee is
        // owed); the desk can still cancel on their behalf.
        GymClass enrolledClass = enrollment.getGymClass();
        if (!isStaff && enrolledClass != null && enrolledClass.getStartDate() != null
                && !enrolledClass.getStartDate().isAfter(SessionEligibility.today(clock))) {
            throw new BadRequestException("SCHEDULING_CANNOT_CANCEL_STARTED_COURSE",
                    "error.scheduling.cannot_cancel_started_course", null,
                    "Không thể hủy khóa học đã hoặc đang bắt đầu");
        }

        // Releasing the seat while VNPay may still confirm the fee would take the member's money for nothing.
        if (vnpayGuard != null) vnpayGuard.enrollment(enrollment.getId());

        LocalDateTime now = LocalDateTime.now(clock);
        enrollment.setStatus(CANCELLED);
        enrollment.setCancelledAt(now);
        enrollment.setCancelReason(msg("scheduling.enrollment.cancelled_by_role", principal.role()));

        // An unpaid course fee must not stay payable once the seat is released.
        if (paymentRepository != null) {
            paymentRepository.findByClassEnrollmentId(enrollment.getId())
                    .filter(payment -> "pending".equalsIgnoreCase(payment.getStatus()))
                    .ifPresent(payment -> {
                        payment.setStatus("failed");
                        paymentRepository.save(payment);
                    });
        }

        ClassEnrollment saved = enrollments.saveAndFlush(enrollment);

        notifications.send(enrollment.getMember().getUserId(),
                msg("notifications.booking.cancelled.title"),
                msg("notifications.booking.cancelled.body"),
                "system",
                "class_enrollment",
                saved.getId());

        return toDto(saved, resolveSessionForClass(enrollment.getGymClass()));
    }

    /**
     * Hủy toàn bộ các lịch lớp học đã đặt trong tương lai của hội viên khi gói tập được bảo lưu.
     * Đồng thời giải phóng chỗ trống cho từng lớp bị ảnh hưởng.
     */
    @Transactional
    public int cancelFutureEnrollmentsForMember(Long memberId, String cancelReason) {
        return cancelFutureEnrollmentsForMember(memberId, cancelReason, date -> false);
    }

    /**
     * Cancels the member's upcoming class bookings whose next session date is not
     * {@code coveredOn}; a predicate that is always false cancels all of them (hold, cancellation).
     */
    @Transactional
    public int cancelFutureEnrollmentsForMember(Long memberId, String cancelReason,
                                                java.util.function.Predicate<LocalDate> coveredOn) {
        if (memberId == null || enrollments == null) {
            return 0;
        }
        String resolvedReason = (cancelReason != null && !cancelReason.isBlank())
                ? cancelReason
                : msg("scheduling.enrollment.cancelled_by_hold");

        // Membership hold/cancellation already owns this lock; standalone callers use it too.
        lockMember(memberId);
        List<Long> classIds = enrollments.findBookedClassIdsByMemberId(memberId).stream()
                .distinct().sorted().toList();
        // Lock classes in ascending order before loading mutable enrollment state.
        List<GymClass> lockedClasses = classIds.stream().map(this::lockClass).toList();
        LocalDateTime now = SessionEligibility.now(clock);
        LocalDate today = now.toLocalDate();
        LocalTime nowTime = now.toLocalTime();
        int cancelledCount = 0;
        for (GymClass gymClass : lockedClasses) {
            java.util.Optional<LocalDate> nextSession = nextOpenSessionDate(gymClass, today, nowTime);
            if (nextSession.isPresent() && coveredOn.test(nextSession.get())) {
                continue;
            }
            var booking = enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), memberId, BOOKED);
            if (booking.isPresent() && nextSession.isPresent()) {
                ClassEnrollment enrollment = booking.get();
                enrollment.setStatus(CANCELLED);
                enrollment.setCancelledAt(now);
                enrollment.setCancelReason(resolvedReason);
                ClassEnrollment saved = enrollments.saveAndFlush(enrollment);
                cancelledCount++;
                notifications.send(memberId, msg("notifications.booking.cancelled.title"),
                        msg("notifications.booking.cancelled.body"), "system", "class_enrollment", saved.getId());
            }
        }

        if (sessionBookingService != null) {
            cancelledCount += sessionBookingService.cancelFutureForMember(memberId, resolvedReason, coveredOn);
        }
        return cancelledCount;
    }

    /** Date of the class's next session that has not ended; today when the schedule is unknown, empty when none. */
    private java.util.Optional<LocalDate> nextOpenSessionDate(GymClass gymClass, LocalDate today, LocalTime nowTime) {
        if (gymClass == null || gymClass.getId() == null || sessions == null) {
            return java.util.Optional.of(today);
        }
        List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(gymClass.getId());
        if (classSessions == null || classSessions.isEmpty()) {
            return java.util.Optional.of(today);
        }
        return classSessions.stream()
                .filter(s -> !"cancelled".equalsIgnoreCase(s.getStatus())
                        && !"completed".equalsIgnoreCase(s.getStatus()))
                .filter(s -> s.getSessionDate() == null
                        || s.getSessionDate().isAfter(today)
                        || (s.getSessionDate().isEqual(today)
                            && (s.getEndTime() == null || !s.getEndTime().isBefore(nowTime))))
                .map(s -> s.getSessionDate() == null ? today : s.getSessionDate())
                .findFirst();
    }

    private GymClass lockClass(Long classId) {
        return gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
    }

    private Member lockMember(Long memberId) {
        return members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> myEnrollments(AuthenticatedPrincipal principal) {
        return myEnrollments(principal, null);
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> myEnrollments(AuthenticatedPrincipal principal, String status) {
        findMember(principal.id());
        String normalizedStatus = status != null && !status.isBlank() ? status.trim() : null;
        return enrollments.findByMemberUserId(principal.id()).stream()
                .filter(enrollment -> normalizedStatus == null
                        || normalizedStatus.equalsIgnoreCase(enrollment.getStatus()))
                .map(enrollment -> toDto(enrollment, resolveSessionForClass(enrollment.getGymClass())))
                .toList();
    }

    // Không dùng readOnly: lockMember lấy khóa ghi (SELECT ... FOR NO KEY UPDATE), PostgreSQL từ chối trong giao dịch chỉ đọc (HTTP 500).
    @Transactional
    public QuotaDto getMemberCourseQuota(AuthenticatedPrincipal principal) {
        Member member = lockMember(principal.id());
        LocalDate today = SessionEligibility.today(clock);
        List<com.swp391.scms.membership.entity.MembershipSubscription> activeSubs = subscriptions.findByMemberUserIdAndStatus(member.getUserId(), "active");
        com.swp391.scms.membership.entity.MembershipSubscription currentSub = activeSubs.stream()
                .filter(s -> !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                .findFirst()
                .or(() -> activeSubs.stream().findFirst())
                .orElse(null);

        var blockedUntil = member.getCourseEnrollBlockedUntil() != null
                && member.getCourseEnrollBlockedUntil().isAfter(SessionEligibility.now(clock))
                ? member.getCourseEnrollBlockedUntil() : null;
        if (currentSub == null || currentSub.getMembershipPackage() == null) {
            return new QuotaDto(null, 0, 0, 0, false, blockedUntil, 0);
        }

        var pkg = currentSub.getMembershipPackage();
        String tier = pkg.getTier() != null ? pkg.getTier() : pkg.getName();
        Integer creditLimit = pkg.getClassCreditLimit();
        boolean unlimited = (creditLimit == null);

        // After an upgrade the credits already spent on the earlier plan still count against the new allowance.
        long used = enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(
                member.getUserId(),
                BOOKED,
                creditWindowStart(currentSub),
                currentSub.getEndDate()
        );

        int total = unlimited ? 999999 : creditLimit;
        int remaining = unlimited ? 999999 : Math.max(0, creditLimit - (int) used);

        return new QuotaDto(tier, creditLimit, (int) used, remaining, unlimited, blockedUntil,
                com.swp391.scms.facilities.PackageBenefits.discountPercent(pkg));
    }

    /** Start of the period whose credits are shared: an upgrade continues the plan it replaced. */
    private static LocalDate creditWindowStart(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        return com.swp391.scms.facilities.PackageBenefits.cycleAnchor(sub);
    }

    /** A member who missed more than half of a course cannot join another one until the block ends. */
    private void ensureNotBlocked(Member member) {
        var until = member.getCourseEnrollBlockedUntil();
        if (until != null && until.isAfter(SessionEligibility.now(clock))) {
            throw new ForbiddenException("SCHEDULING_COURSE_ENROLL_BLOCKED", "error.scheduling.course_enroll_blocked",
                    new Object[]{until.toLocalDate().toString()},
                    "Đăng ký khóa học tạm khóa đến " + until.toLocalDate() + " do vắng quá 50% số buổi của một khóa trước.");
        }
    }

    @Transactional
    public EnrollmentDto enrollCourse(AuthenticatedPrincipal principal, Long classId) {
        Member member = lockMember(principal.id());
        ensureNotBlocked(member);
        GymClass gymClass = gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        if (gymClass.getStatus() != null && !"active".equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException("SCHEDULING_CLASS_INACTIVE", "error.scheduling.class_inactive", null,
                    "Class is currently inactive");
        }

        LocalDate today = SessionEligibility.today(clock);
        // Same rule as checkoutCourse: a course is joined as a whole, so once it has started it is closed. Checking it
        // first keeps the member from seeing a misleading "membership does not cover <start date>" error instead.
        if (gymClass.getStartDate() != null && gymClass.getStartDate().isBefore(today)) {
            throw new BadRequestException("SCHEDULING_COURSE_ALREADY_STARTED", "error.scheduling.course_already_started", null,
                    "Khóa học đã bắt đầu, không thể đăng ký thêm.");
        }
        LocalDate startDate = gymClass.getStartDate() != null ? gymClass.getStartDate() : today;
        SessionEligibility.ensureMembershipCoversSession(subscriptions, member.getUserId(), startDate, clock);
        SessionEligibility.ensureMembershipCoversCourse(subscriptions, member.getUserId(), startDate, gymClass.getEndDate());
        SessionEligibility.ensurePlatinumRoomAccess(subscriptions, member.getUserId(), gymClass.getRoom(), startDate);

        if (enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), member.getUserId(), BOOKED).isPresent()) {
            throw new ConflictException("SCHEDULING_ALREADY_ENROLLED", "error.scheduling.already_enrolled", null,
                    "Member already has an active booking for this class");
        }

        // A course holds the member in every session: no other class, court or 1:1 booking may overlap any of them.
        if (scheduleGuard != null) {
            scheduleGuard.ensureCourseFree(member.getUserId(), gymClass);
        }

        // Quota check
        QuotaDto quota = getMemberCourseQuota(principal);
        if (!quota.unlimited() && quota.remainingCredits() <= 0) {
            throw new ForbiddenException("SCHEDULING_COURSE_QUOTA_EXCEEDED", "error.scheduling.course_quota_exceeded", null,
                    "Bạn đã sử dụng hết lượt đăng ký khóa học của gói tập. Vui lòng thanh toán học phí để đăng ký thêm.");
        }

        long booked = enrollments.countByGymClassIdAndStatus(gymClass.getId(), BOOKED);
        if (booked >= gymClass.getCapacity()) {
            throw new ConflictException("SCHEDULING_CLASS_FULL", "error.scheduling.class_full", null, "Class is full");
        }

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus(BOOKED);
        enrollment.setEnrolledAt(LocalDateTime.now(clock));

        ClassEnrollment saved = enrollments.save(enrollment);

        ClassSession representativeSession = resolveSessionForClass(gymClass);
        if (notifications != null) {
            notifications.send(
                    member.getUserId(),
                    msg("notifications.booking.class_enrolled.title"),
                    msg("notifications.booking.class_enrolled.body", gymClass.getName()),
                    "system",
                    "class_enrollment",
                    saved.getId()
            );
        }

        return toDto(saved, representativeSession);
    }

    @Transactional
    public CourseCheckoutDto checkoutCourse(AuthenticatedPrincipal principal, Long classId, String method) {
        Member member = lockMember(principal.id());
        ensureNotBlocked(member);
        GymClass gymClass = gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        if (gymClass.getStatus() != null && !"active".equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException("SCHEDULING_CLASS_INACTIVE", "error.scheduling.class_inactive", null, "Class is currently inactive");
        }

        LocalDate today = SessionEligibility.today(clock);
        if (gymClass.getStartDate() != null && gymClass.getStartDate().isBefore(today)) {
            throw new BadRequestException("SCHEDULING_COURSE_ALREADY_STARTED", "error.scheduling.course_already_started", null,
                    "Khóa học đã bắt đầu, không thể đăng ký thêm.");
        }

        SessionEligibility.ensureMembershipCoversSession(subscriptions, member.getUserId(), gymClass.getStartDate() != null ? gymClass.getStartDate() : today, clock);
        SessionEligibility.ensureMembershipCoversCourse(subscriptions, member.getUserId(),
                gymClass.getStartDate() != null ? gymClass.getStartDate() : today, gymClass.getEndDate());

        if (enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), member.getUserId(), BOOKED).isPresent()) {
            throw new ConflictException("SCHEDULING_ALREADY_ENROLLED", "error.scheduling.already_enrolled", null,
                    "Member already has an active booking for this class");
        }

        long booked = enrollments.countByGymClassIdAndStatus(gymClass.getId(), BOOKED);
        if (booked >= gymClass.getCapacity()) {
            throw new ConflictException("SCHEDULING_CLASS_FULL", "error.scheduling.class_full", null, "Class is full");
        }

        if (scheduleGuard != null) {
            scheduleGuard.ensureCourseFree(member.getUserId(), gymClass);
        }

        QuotaDto quota = getMemberCourseQuota(principal);
        if (quota.unlimited() || quota.remainingCredits() > 0) {
            EnrollmentDto enrolled = enrollCourse(principal, classId);
            return new CourseCheckoutDto(
                    enrolled.id(),
                    null,
                    gymClass.getId(),
                    gymClass.getName(),
                    BigDecimal.ZERO,
                    "free_quota",
                    "success",
                    null,
                    null
            );
        }

        BigDecimal listPrice = gymClass.getPrice() != null ? gymClass.getPrice() : BigDecimal.ZERO;
        // Gold and Platinum members get 10% / 20% off the course fee once their free credits are used up.
        int discountPercent = memberDiscounts != null ? memberDiscounts.percentFor(member.getUserId()) : 0;
        BigDecimal price = MemberDiscountService.apply(listPrice, discountPercent);
        String normalizedMethod = method != null ? method.toLowerCase() : "cash";
        if (!List.of("cash", "online_wallet", "vnpay").contains(normalizedMethod)) {
            normalizedMethod = "cash";
        }

        // Paying from the wallet needs the money up front: no seat is held for a fee the wallet cannot cover.
        if ("online_wallet".equals(normalizedMethod) && wallets != null && price.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal balance = wallets.getMyWallet(member.getUserId()).balance();
            BigDecimal available = balance != null ? balance : BigDecimal.ZERO;
            if (available.compareTo(price) < 0) {
                throw new BadRequestException("INSUFFICIENT_WALLET_BALANCE", "error.wallet.insufficient_balance",
                        new Object[]{available.toPlainString()},
                        "Số dư Ví không đủ để thanh toán học phí (hiện có " + available.toPlainString() + " đ, cần " + price.toPlainString() + " đ).");
            }
        }

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus(BOOKED);
        enrollment.setEnrolledAt(LocalDateTime.now(clock));
        ClassEnrollment savedEnrollment = enrollments.save(enrollment);
        LocalDateTime holdUntil = "cash".equals(normalizedMethod) && gymClass.getStartDate() != null
                ? gymClass.getStartDate().atStartOfDay()
                : LocalDateTime.now(clock).plusMinutes(ONLINE_HOLD_MINUTES);

        Long paymentId = null;
        String paymentStatus = "pending";
        String paymentUrl = null;

        if (paymentRepository != null && price.compareTo(BigDecimal.ZERO) > 0) {
            Payment payment = new Payment();
            payment.setMember(member);
            payment.setClassEnrollmentId(savedEnrollment.getId());
            payment.setAmount(price);
            payment.setMethod("vnpay".equals(normalizedMethod) ? "online_wallet" : normalizedMethod);
            payment.setStatus("pending");
            payment.setNote("Học phí khóa học: " + gymClass.getName()
                    + (discountPercent > 0 ? " (giảm " + discountPercent + "%, giá gốc " + listPrice.toPlainString() + ")" : ""));
            Payment savedPayment = paymentRepository.save(payment);
            paymentId = savedPayment.getId();

            if ("vnpay".equals(normalizedMethod) && vnpayPaymentService != null && vnpayPaymentService.enabled()) {
                try {
                    var checkout = vnpayPaymentService.checkout(
                            principal,
                            new com.swp391.scms.finance.dto.VnpayDtos.CheckoutRequest(null, null, null, savedPayment.getId()),
                            "127.0.0.1"
                    );
                    paymentUrl = checkout.paymentUrl();
                } catch (Exception ex) {
                    // The payment stays pending so reception can still collect it; the member can retry online.
                    org.slf4j.LoggerFactory.getLogger(EnrollmentService.class)
                            .warn("VNPay checkout could not be created for course payment {}", savedPayment.getId(), ex);
                }
            }
        }

        return new CourseCheckoutDto(
                savedEnrollment.getId(),
                paymentId,
                gymClass.getId(),
                gymClass.getName(),
                price,
                normalizedMethod,
                paymentStatus,
                paymentUrl,
                paymentId != null ? holdUntil : null
        );
    }

    @Transactional
    public EnrollmentDto cancelCourseEnrollment(AuthenticatedPrincipal principal, Long classId) {
        Member member = lockMember(principal.id());
        ClassEnrollment enrollment = enrollments.findByGymClassIdAndMemberUserIdAndStatus(classId, member.getUserId(), BOOKED)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", classId));

        GymClass gymClass = enrollment.getGymClass();
        LocalDate today = SessionEligibility.today(clock);
        if (gymClass != null && gymClass.getStartDate() != null && !gymClass.getStartDate().isAfter(today)) {
            throw new BadRequestException("SCHEDULING_CANNOT_CANCEL_STARTED_COURSE", "error.scheduling.cannot_cancel_started_course", null,
                    "Không thể hủy khóa học đã hoặc đang bắt đầu");
        }
        if (vnpayGuard != null) vnpayGuard.enrollment(enrollment.getId());

        enrollment.setStatus(CANCELLED);
        enrollment.setCancelledAt(LocalDateTime.now(clock));
        enrollment.setCancelledBy(member.getUser());
        enrollment.setCancelReason("Member requested cancellation");

        // An unpaid course fee must not stay payable once the seat is released; a settled fee is refunded to the wallet.
        if (paymentRepository != null) {
            paymentRepository.findByClassEnrollmentId(enrollment.getId()).ifPresent(payment -> {
                if ("pending".equalsIgnoreCase(payment.getStatus())) {
                    payment.setStatus("failed");
                    paymentRepository.save(payment);
                } else if ("success".equalsIgnoreCase(payment.getStatus())) {
                    BigDecimal refundable = payment.netAmount();
                    if (refundable.compareTo(BigDecimal.ZERO) > 0) {
                        payment.setRefundedAmount(payment.getAmount());
                        payment.setStatus("refunded");
                        paymentRepository.save(payment);
                        if (wallets != null) {
                            wallets.creditCourseRefund(member.getUserId(), refundable,
                                    "COURSE_REFUND_" + enrollment.getId(), "Member requested cancellation");
                        }
                    }
                }
            });
        }

        ClassEnrollment saved = enrollments.save(enrollment);
        return toDto(saved, resolveSessionForClass(gymClass));
    }

    /**
     * Frees seats held for course fees that were never paid: an online (wallet/VNPay) fee after {@value #ONLINE_HOLD_MINUTES}
     * minutes, and a counter (cash) fee once the course starts. Fees a payment gateway may still confirm are left alone.
     */
    @Transactional
    public int expireUnpaidCourseEnrollments() {
        if (paymentRepository == null) {
            return 0;
        }
        LocalDateTime current = LocalDateTime.now(clock);
        LocalDate today = current.toLocalDate();
        int released = 0;
        for (Payment payment : paymentRepository.findPendingCourseFeesCreatedBefore(current)) {
            try {
                // Closes attempts past expiry + IPN grace; one VNPay may still settle keeps the fee and the seat.
                if (vnpayGuard != null) vnpayGuard.payment(payment.getId());
            } catch (RuntimeException awaitingGateway) {
                continue;
            }
            ClassEnrollment enrollment = enrollments.findById(payment.getClassEnrollmentId()).orElse(null);
            if (enrollment == null || !BOOKED.equals(enrollment.getStatus())) {
                payment.setStatus("failed");
                paymentRepository.save(payment);
                continue;
            }
            boolean cash = "cash".equalsIgnoreCase(payment.getMethod());
            GymClass gymClass = enrollment.getGymClass();
            boolean due = cash
                    ? gymClass != null && gymClass.getStartDate() != null && !gymClass.getStartDate().isAfter(today)
                    : payment.getCreatedAt() != null && payment.getCreatedAt().isBefore(current.minusMinutes(ONLINE_HOLD_MINUTES));
            if (!due) {
                continue;
            }
            payment.setStatus("failed");
            paymentRepository.save(payment);
            enrollment.setStatus(CANCELLED);
            enrollment.setCancelledAt(current);
            enrollment.setCancelReason("Tự động hủy do chưa thanh toán học phí.");
            enrollments.save(enrollment);
            released++;
        }
        return released;
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> getMyCourseEnrollments(AuthenticatedPrincipal principal) {
        Member member = findMember(principal.id());
        List<ClassEnrollment> list = enrollments.findByMemberUserId(member.getUserId());
        return list.stream()
                .map(e -> toDto(e, resolveSessionForClass(e.getGymClass())))
                .toList();
    }

    private ClassSession resolveSessionForClass(GymClass gymClass) {
        if (gymClass == null || gymClass.getId() == null || sessions == null) {
            return null;
        }
        List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(gymClass.getId());
        if (classSessions == null || classSessions.isEmpty()) {
            return null;
        }
        LocalDate today = SessionEligibility.today(clock);
        return classSessions.stream()
                .filter(s -> s.getSessionDate() != null && !s.getSessionDate().isBefore(today)
                        && !"cancelled".equalsIgnoreCase(s.getStatus()))
                .findFirst()
                .orElse(classSessions.get(0));
    }

    private boolean isStaffRole(String role) {
        return ROLE_CENTER_MANAGER.equals(role)
                || ROLE_MANAGER.equals(role)
                || ROLE_STAFF.equals(role)
                || ROLE_RECEPTIONIST.equals(role);
    }

    private ClassSession findSession(Long sessionId) {
        return sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
    }

    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    private EnrollmentDto toDto(ClassEnrollment enrollment, ClassSession session) {
        GymClass gymClass = enrollment.getGymClass();
        Integer[] progress = courseProgress(enrollment);
        return new EnrollmentDto(
                enrollment.getId(),
                gymClass != null ? gymClass.getId() : null,
                gymClass != null ? gymClass.getName() : null,
                enrollment.getMember() != null ? enrollment.getMember().getUserId() : null,
                session != null ? session.getId() : null,
                session != null ? session.getSessionDate() : null,
                session != null ? session.getStartTime() : null,
                session != null ? session.getEndTime() : null,
                enrollment.getStatus(),
                enrollment.getEnrolledAt(),
                enrollment.getCancelledAt(),
                enrollment.getCancelReason(),
                progress[0], progress[1], progress[2]
        );
    }

    /** {total, attended, remaining} sessions of the member's course, or nulls when the course has no schedule data. */
    private Integer[] courseProgress(ClassEnrollment enrollment) {
        GymClass gymClass = enrollment.getGymClass();
        if (sessions == null || attendanceRepository == null || gymClass == null || gymClass.getId() == null
                || enrollment.getMember() == null || enrollment.getMember().getUserId() == null) {
            return new Integer[]{null, null, null};
        }
        long total = sessions.countByGymClassIdAndStatusNot(gymClass.getId(), "cancelled");
        Long memberId = enrollment.getMember().getUserId();
        long attended = attendanceRepository.countAttended(memberId, gymClass.getId());
        long recorded = attendanceRepository.countRecorded(memberId, gymClass.getId());
        return new Integer[]{(int) total, (int) attended, (int) Math.max(0, total - recorded)};
    }

    @Autowired(required = false)
    private com.swp391.scms.attendance.repository.SessionAttendanceRepository attendanceRepository;
}
