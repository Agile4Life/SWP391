package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.dto.*;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.membership.service.MemberDiscountService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Nghiệp vụ đặt buổi PT 1:1 với HLV theo 5 slot cố định (07:00–19:30): khung giờ trống, lượt PT miễn phí theo
 * hạng gói, đặt lịch (kiểm tra trùng lịch, nghỉ phép, gói còn hiệu lực), buổi trả tiền theo slot thu ở quầy,
 * hủy lịch kèm hoàn tiền, điểm danh và tự giải phóng buổi chưa trả tiền.
 */
@Service
public class CoachBookingService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CoachBookingService.class);
    private final com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    private static final int ADVANCE_MINUTES_REQUIRED = 120; // 2 giờ
    private static final int UNPAID_HOLD_MINUTES = 15;
    private static final int UNPAID_RELEASE_LEAD_MINUTES = 60;
    private static final int UNPAID_MIN_HOLD_MINUTES = 5;
    private static final java.util.Set<String> ALLOWED_PAYMENT_METHODS =
            java.util.Set.of("package_quota", "cash", "bank_transfer");
    private static final int MAX_UNPAID_UPCOMING = 2;
    private static final java.util.Set<String> DESK_ROLES = java.util.Set.of("RECEPTIONIST", "CENTER_MANAGER");

    @Autowired(required = false)
    private PtAttendanceService ptAttendance;

    @Autowired(required = false)
    private com.swp391.scms.scheduling.service.MemberScheduleGuard scheduleGuard;

    @Autowired(required = false)
    private com.swp391.scms.finance.repository.PaymentRepository paymentRepository;

    @Autowired(required = false)
    private com.swp391.scms.finance.service.InvoiceService invoiceService;

    @Autowired(required = false)
    private com.swp391.scms.wallet.WalletService walletService;

    @Autowired(required = false)
    private com.swp391.scms.users.UserRepository userRepository;

    @Autowired(required = false)
    private com.swp391.scms.operations.repository.StaffInternalRequestRepository staffRequestRepository;

    @Autowired(required = false)
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Autowired(required = false)
    private jakarta.persistence.EntityManager entityManager;

    /** Gán TransactionManager (dùng cho test cô lập transaction theo từng lịch đặt). */
    public void setTransactionManager(org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.transactionManager = transactionManager;
    }

    @org.springframework.beans.factory.annotation.Value("${app.legacy.classes-enabled:false}")
    private boolean legacyClassesEnabled = true;

    /** HLV có đơn nghỉ phép đã duyệt vào ngày cho trước không. */
    private boolean onLeave(Long coachId, LocalDate date) {
        return staffRequestRepository != null && staffRequestRepository.existsApprovedLeaveOn(coachId, date);
    }
    private static final BigDecimal DEFAULT_HOURLY_RATE = new BigDecimal("200000.00");

    private final CoachBookingRepository coachBookingRepository;
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final ClassSessionRepository classSessionRepository;
    private final ClassEnrollmentRepository classEnrollmentRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final DisciplineRepository disciplineRepository;
    private final NotificationService notificationService;
    private final Clock clock;
    private final MessageService messageService;

    /** Constructor cho test với các phụ thuộc tối thiểu. */
    public CoachBookingService(
            CoachBookingRepository coachBookingRepository,
            CoachRepository coachRepository,
            MemberRepository memberRepository,
            ClassSessionRepository classSessionRepository,
            ClassEnrollmentRepository classEnrollmentRepository,
            MembershipSubscriptionRepository subscriptionRepository,
            DisciplineRepository disciplineRepository,
            Clock clock,
            MessageService messageService) {
        this(coachBookingRepository, coachRepository, memberRepository, classSessionRepository,
                classEnrollmentRepository, subscriptionRepository, disciplineRepository, null, clock, messageService);
    }

    /** Constructor cho test có thêm dịch vụ phụ. */
    public CoachBookingService(
            CoachBookingRepository coachBookingRepository,
            CoachRepository coachRepository,
            MemberRepository memberRepository,
            ClassSessionRepository classSessionRepository,
            ClassEnrollmentRepository classEnrollmentRepository,
            MembershipSubscriptionRepository subscriptionRepository,
            DisciplineRepository disciplineRepository,
            @Autowired(required = false) NotificationService notificationService,
            Clock clock,
            MessageService messageService) {
        this(coachBookingRepository, coachRepository, memberRepository, classSessionRepository, classEnrollmentRepository, subscriptionRepository, disciplineRepository, notificationService, clock, messageService, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public CoachBookingService(
            CoachBookingRepository coachBookingRepository,
            CoachRepository coachRepository,
            MemberRepository memberRepository,
            ClassSessionRepository classSessionRepository,
            ClassEnrollmentRepository classEnrollmentRepository,
            MembershipSubscriptionRepository subscriptionRepository,
            DisciplineRepository disciplineRepository,
            @Autowired(required = false) NotificationService notificationService,
            Clock clock,
            MessageService messageService, com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard) {
        this.vnpayGuard = vnpayGuard;
        this.coachBookingRepository = coachBookingRepository;
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.classSessionRepository = classSessionRepository;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.disciplineRepository = disciplineRepository;
        this.notificationService = notificationService;
        this.clock = (clock != null ? clock : Clock.system(com.swp391.scms.common.CenterTime.ZONE))
                .withZone(com.swp391.scms.common.CenterTime.ZONE);
        this.messageService = messageService;
    }

    /** Danh sách HLV công khai (đang làm việc, tài khoản active) để hội viên chọn. */
    @Transactional(readOnly = true)
    public List<CoachPublicDto> getPublicCoaches() {
        return coachRepository.findPublicCoaches().stream()
                .map(c -> new CoachPublicDto(
                        c.getUserId(),
                        c.getUser() != null ? c.getUser().getFullName() : "HLV",
                        c.getUser() != null ? c.getUser().getEmail() : "",
                        c.getUser() != null ? c.getUser().getPhone() : "",
                        c.getSpecialization(),
                        c.getBio(),
                        c.getCertification(),
                        c.getUser() != null ? c.getUser().getAvatarUrl() : null,
                        DEFAULT_HOURLY_RATE
                ))
                .toList();
    }

    /**
     * 5 khung giờ cố định (Slot 1–Slot 5, 07:00–19:30) trong ngày của HLV, đánh dấu còn trống hay không và lý do:
     * HLV nghỉ phép, quá gần giờ (cần đặt trước 2 giờ), HLV bận, hoặc hội viên bận.
     */
    @Transactional(readOnly = true)
    public List<CoachAvailableSlotDto> getAvailableSlots(Long coachId, LocalDate date, Long currentMemberId) {
        Coach coach = coachRepository.findById(coachId)
                .orElseThrow(() -> new ResourceNotFoundException("Coach", coachId));

        List<ClassSession> coachClasses = legacyClassesEnabled ? classSessionRepository.findActiveByCoachAndDate(coachId, date) : List.of();
        List<CoachBooking> coachBookings = coachBookingRepository.findActiveByCoachAndDate(coachId, date);

        List<ClassSession> memberClasses = legacyClassesEnabled && currentMemberId != null
                ? classSessionRepository.findActiveByMemberAndDate(currentMemberId, date) : List.of();
        List<CoachBooking> memberBookings = currentMemberId != null ? coachBookingRepository.findActiveByMemberAndDate(currentMemberId, date) : List.of();

        LocalDateTime now = LocalDateTime.now(clock);
        List<CoachAvailableSlotDto> slots = new ArrayList<>();
        boolean coachOnLeave = onLeave(coachId, date);

        for (ScheduleSlot slot : ScheduleSlot.values()) {
            LocalTime start = slot.startTime();
            LocalTime end = slot.endTime();

            LocalDateTime slotStartDateTime = LocalDateTime.of(date, start);

            boolean isTooSoon = slotStartDateTime.isBefore(now.plusMinutes(ADVANCE_MINUTES_REQUIRED));

            boolean coachBusy = coachClasses.stream().anyMatch(cs ->
                    start.isBefore(cs.getEndTime()) && end.isAfter(cs.getStartTime()))
                    || coachBookings.stream().anyMatch(cb ->
                    start.isBefore(cb.getEndTime()) && end.isAfter(cb.getStartTime()));

            boolean memberBusy = memberClasses.stream().anyMatch(cs ->
                    start.isBefore(cs.getEndTime()) && end.isAfter(cs.getStartTime()))
                    || memberBookings.stream().anyMatch(mb ->
                    start.isBefore(mb.getEndTime()) && end.isAfter(mb.getStartTime()));

            boolean available = !coachOnLeave && !isTooSoon && !coachBusy && !memberBusy;
            String reason = null;
            if (!available) {
                if (coachOnLeave) {
                    reason = "coach_on_leave";
                } else if (isTooSoon) {
                    reason = "too_soon";
                } else if (coachBusy) {
                    reason = "coach_busy";
                } else {
                    reason = "member_busy";
                }
            }

            slots.add(new CoachAvailableSlotDto(slot.slotNumber(), start, end, available, reason));
        }

        return slots;
    }

    /**
     * Số buổi PT 1:1 miễn phí mỗi chu kỳ 30 ngày theo hạng gói (spec 2026-11-09; gói trải nghiệm 1 buổi).
     */
    private int ptQuotaOf(MembershipSubscription sub, boolean trial) {
        if (trial) return 1;
        return PackageBenefits.ptSessionsPerCycle(sub.getMembershipPackage());
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private MemberDiscountService memberDiscounts;

    /** Kỳ gói có phải gói trải nghiệm không (theo gói hoặc kỳ dài tối đa 3 ngày). */
    private boolean isTrialSubscription(MembershipSubscription sub) {
        if (sub == null) return false;
        if (PackageBenefits.isTrial(sub.getMembershipPackage())) {
            return true;
        }
        if (sub.getUpgradeCharge() == null && !"expired".equalsIgnoreCase(sub.getStatus())
                && sub.getStartDate() != null && sub.getEndDate() != null) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(sub.getStartDate(), sub.getEndDate());
            return days >= 0 && days <= 3;
        }
        return false;
    }

    /** Tình trạng lượt PT miễn phí của hội viên trong chu kỳ hiện tại: tên gói, số lượt, đã dùng và còn lại. */
    @Transactional(readOnly = true)
    public CoachQuotaStatusDto getMemberQuotaStatus(Long memberUserId) {
        List<MembershipSubscription> activeSubs = subscriptionRepository.findByMemberUserIdAndStatus(memberUserId, "active").stream()
                .filter(sub -> sub.getStartDate() != null && sub.getEndDate() != null
                        && !sub.getStartDate().isAfter(LocalDate.now(clock))
                        && !sub.getEndDate().isBefore(LocalDate.now(clock)))
                .toList();
        if (activeSubs.isEmpty()) {
            return new CoachQuotaStatusDto(null, 0, 0, 0);
        }
        MembershipSubscription sub = activeSubs.get(0);
        boolean isTrial = isTrialSubscription(sub);
        String pkgName = isTrial ? "Gói Trải Nghiệm 3 Ngày"
                : sub.getMembershipPackage() != null && sub.getMembershipPackage().getName() != null
                        ? sub.getMembershipPackage().getName() : "";
        int monthlyQuota = ptQuotaOf(sub, isTrial);

        LocalDate now = LocalDate.now(clock);
        LocalDate startMonth = PackageBenefits.cycleStart(sub, now);
        LocalDate endMonth = PackageBenefits.cycleEnd(sub, now);
        long usedQuota = countQuotaUsageForSubscription(memberUserId, sub, startMonth, endMonth);

        int remaining = Math.max(0, monthlyQuota - (int) usedQuota);
        return new CoachQuotaStatusDto(pkgName, monthlyQuota, (int) usedQuota, remaining);
    }

    /**
     * Đếm số lượt PT miễn phí đã dùng của {@code sub} (và bất kỳ gói trước không phải trải nghiệm trong chuỗi nâng
     * cấp giữa chu kỳ), để buổi PT trải nghiệm miễn phí không bao giờ trừ vào hạn mức của gói Gold/Platinum mới mua.
     */
    private long countQuotaUsageForSubscription(Long memberUserId, MembershipSubscription sub,
                                                LocalDate startMonth, LocalDate endMonth) {
        List<Long> subIds = new ArrayList<>();
        java.util.Set<Long> seen = new java.util.HashSet<>();
        MembershipSubscription current = sub;
        MembershipSubscription earliest = sub;
        while (current != null && !isTrialSubscription(current)) {
            if (current.getId() != null) {
                if (!seen.add(current.getId())) break;
                subIds.add(current.getId());
            }
            earliest = current;
            if (current.getUpgradeCharge() != null && current.getPreviousSubscription() != null
                    && !isTrialSubscription(current.getPreviousSubscription())) {
                current = current.getPreviousSubscription();
            } else {
                break;
            }
        }
        if (isTrialSubscription(sub) && sub.getId() != null) {
            subIds.add(sub.getId());
        }
        if (subIds.isEmpty()) {
            return coachBookingRepository.countMonthlyQuotaUsage(memberUserId, startMonth, endMonth, "package_quota");
        }
        LocalDateTime subCreatedAt = earliest.getCreatedAt() != null
                ? earliest.getCreatedAt()
                : (earliest.getStartDate() != null ? earliest.getStartDate().atStartOfDay() : LocalDateTime.of(2000, 1, 1, 0, 0));
        return coachBookingRepository.countSubscriptionQuotaUsage(
                memberUserId, startMonth, endMonth, "package_quota", subIds, subCreatedAt);
    }

    /**
     * Đặt buổi PT: khóa dòng hội viên để đếm lượt chính xác; HLV phải đang làm và không nghỉ phép; thuộc 1 trong
     * 5 slot cố định (07:00–19:30), đặt trước ít nhất 2 giờ; không trùng lịch HLV/hội viên, không rơi vào ngày
     * bảo lưu; hội viên phải có gói hiệu lực. Dùng lượt gói thì phải còn lượt; trả theo slot thì tối đa 2 buổi
     * chưa trả, giá được giảm theo hạng gói và tạo khoản thu chờ. Gửi thông báo cho HLV và hội viên.
     */
    @Transactional
    public CoachBookingDto createBooking(AuthenticatedPrincipal principal, CoachBookingCreateDto request) {
        // Khóa dòng tuần tự hóa các yêu cầu đặt lịch đồng thời của một hội viên để phép đếm hạn mức bên dưới luôn chính xác.
        Member member = memberRepository.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("Member", principal.id()));

        Coach coach = coachRepository.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("Coach", request.coachId()));

        if (!"active".equalsIgnoreCase(coach.getEmploymentStatus())) {
            throw new BadRequestException("COACH_INACTIVE", "error.coach.inactive", null, "Huấn luyện viên hiện không nhận học viên.");
        }
        if (request.bookingDate() != null && onLeave(coach.getUserId(), request.bookingDate())) {
            throw new ConflictException("COACH_ON_LEAVE", "error.coach_booking.coach_on_leave",
                    new Object[]{request.bookingDate()}, "The coach is on approved leave that day.");
        }

        String paymentMethod = request.paymentMethod() != null
                ? request.paymentMethod().trim().toLowerCase(java.util.Locale.ROOT) : "package_quota";
        if (!ALLOWED_PAYMENT_METHODS.contains(paymentMethod)) {
            throw new BadRequestException("INVALID_PAYMENT_METHOD", "error.coach_booking.invalid_payment_method", null,
                    "Unsupported payment method.");
        }

        if (request.startTime() == null || request.endTime() == null
                || request.endTime().isBefore(request.startTime()) || request.endTime().equals(request.startTime())) {
            throw new BadRequestException("INVALID_TIME_RANGE", "error.scheduling.invalid_time_range", null, "Giờ kết thúc phải sau giờ bắt đầu.");
        }

        ScheduleSlot.requireValid(
                request.startTime(),
                request.endTime(),
                "INVALID_COACH_BOOKING_SLOT",
                "error.coach_booking.invalid_slot");

        // Quy tắc 1: Yêu cầu đặt trước tối thiểu 2 giờ
        LocalDateTime bookingStart = LocalDateTime.of(request.bookingDate(), request.startTime());
        LocalDateTime now = LocalDateTime.now(clock);
        if (bookingStart.isBefore(now.plusMinutes(ADVANCE_MINUTES_REQUIRED))) {
            throw new BadRequestException(
                    "COACH_BOOKING_TOO_SOON",
                    "error.coach_booking.too_soon",
                    new Object[]{ADVANCE_MINUTES_REQUIRED / 60},
                    "Buổi tập 1:1 với Huấn luyện viên phải được đặt trước ít nhất 2 tiếng."
            );
        }

        // Quy tắc 2: Kiểm tra trùng lịch của HLV
        List<ClassSession> coachSessions = legacyClassesEnabled
                ? classSessionRepository.findActiveByCoachAndDate(coach.getUserId(), request.bookingDate()) : List.of();
        for (ClassSession cs : coachSessions) {
            if (request.startTime().isBefore(cs.getEndTime()) && request.endTime().isAfter(cs.getStartTime())) {
                throw new ConflictException(
                        "COACH_SCHEDULE_CONFLICT",
                        "error.coach_booking.coach_busy",
                        new Object[]{cs.getGymClass().getName(), cs.getStartTime().toString(), cs.getEndTime().toString()},
                        "Huấn luyện viên đã có lịch dạy lớp " + cs.getGymClass().getName() + " trong khung giờ này."
                );
            }
        }

        List<CoachBooking> coachBookings = coachBookingRepository.findActiveByCoachAndDate(coach.getUserId(), request.bookingDate());
        for (CoachBooking cb : coachBookings) {
            if (request.startTime().isBefore(cb.getEndTime()) && request.endTime().isAfter(cb.getStartTime())) {
                throw new ConflictException(
                        "COACH_SCHEDULE_CONFLICT",
                        "error.coach_booking.coach_busy_pt",
                        new Object[]{cb.getStartTime().toString(), cb.getEndTime().toString()},
                        "Huấn luyện viên đã có lịch hẹn 1:1 khác trong khung giờ này."
                );
            }
        }

        // Quy tắc 3: Kiểm tra trùng lịch của hội viên
        List<CoachBooking> memberBookings = coachBookingRepository.findActiveByMemberAndDate(member.getUserId(), request.bookingDate());
        for (CoachBooking mb : memberBookings) {
            if (request.startTime().isBefore(mb.getEndTime()) && request.endTime().isAfter(mb.getStartTime())) {
                throw new ConflictException(
                        "MEMBER_SCHEDULE_CONFLICT",
                        "error.coach_booking.member_busy",
                        new Object[]{mb.getStartTime().toString(), mb.getEndTime().toString()},
                        "Bạn đã có lịch hẹn 1:1 khác trong khung giờ này."
                );
            }
        }

        if (legacyClassesEnabled && classSessionRepository.findActiveByMemberAndDate(member.getUserId(), request.bookingDate()).stream()
                .anyMatch(cs -> request.startTime().isBefore(cs.getEndTime()) && request.endTime().isAfter(cs.getStartTime()))) {
            throw new ConflictException("MEMBER_SCHEDULE_CONFLICT", "error.coach_booking.member_busy", null,
                    "Bạn đã có lịch học lớp trong khung giờ này.");
        }
        if (scheduleGuard != null) {
            scheduleGuard.ensureFree(member.getUserId(), request.bookingDate(), request.startTime(), request.endTime(), null);
        }

        List<MembershipSubscription> validSubscriptions = subscriptionRepository
                .findByMemberUserIdAndStatus(member.getUserId(), "active").stream()
                .filter(sub -> sub.getStartDate() != null && sub.getEndDate() != null
                        && !sub.getStartDate().isAfter(LocalDate.now(clock))
                        && !sub.getEndDate().isBefore(LocalDate.now(clock))
                        && !sub.getStartDate().isAfter(request.bookingDate())
                        && !sub.getEndDate().isBefore(request.bookingDate())
                        && !sub.isHeldOn(request.bookingDate()))
                .toList();
        if (subscriptionRepository.existsApprovedHoldCovering(member.getUserId(), request.bookingDate())) {
            throw new BadRequestException("MEMBERSHIP_ON_HOLD", "error.coach_booking.membership_on_hold",
                    new Object[]{request.bookingDate()}, "Gói tập đang bảo lưu vào ngày đặt lịch.");
        }
        if (validSubscriptions.isEmpty()) {
            throw new BadRequestException("MEMBERSHIP_INACTIVE_OR_EXPIRED", "error.coach_booking.no_active_subscription", null,
                    "Bạn chưa có gói tập đang hoạt động (hoặc gói tập không còn hiệu lực vào ngày đặt lịch). Vui lòng đăng ký hoặc kích hoạt gói tập trước khi đặt lịch HLV 1:1.");
        }

        // Quy tắc 4: Kiểm tra thanh toán / hạn mức PT
        String paymentStatus = "used_quota";
        MembershipSubscription usedSubscription = null;

        if ("package_quota".equalsIgnoreCase(paymentMethod)) {
            List<MembershipSubscription> activeSubs = validSubscriptions;
            if (activeSubs.isEmpty()) {
                throw new BadRequestException("MEMBERSHIP_INACTIVE_OR_EXPIRED", "error.coach_booking.no_active_subscription", null, "Bạn cần có gói tập đang hoạt động để đặt lịch HLV.");
            }

            MembershipSubscription sub = activeSubs.get(0);
            usedSubscription = sub;
            boolean isTrial = isTrialSubscription(sub);
            int monthlyQuota = ptQuotaOf(sub, isTrial);

            if (monthlyQuota == 0) {
                throw new BadRequestException(
                        "COACH_BOOKING_PACKAGE_NO_QUOTA",
                        "error.coach_booking.package_no_quota",
                        null,
                        "Gói tập hiện tại (Silver) không bao gồm buổi tập 1:1 miễn phí. Vui lòng chọn thanh toán theo giờ (200.000đ/buổi)."
                );
            }

            LocalDate startMonth = PackageBenefits.cycleStart(sub, request.bookingDate());
            LocalDate endMonth = PackageBenefits.cycleEnd(sub, request.bookingDate());
            long usedQuota = countQuotaUsageForSubscription(member.getUserId(), sub, startMonth, endMonth);

            if (usedQuota >= monthlyQuota) {
                if (isTrial) {
                    throw new BadRequestException(
                            "COACH_BOOKING_TRIAL_QUOTA_EXCEEDED",
                            "error.coach_booking.trial_quota_exceeded",
                            new Object[]{monthlyQuota},
                            "Gói tập trải nghiệm chỉ bao gồm tối đa 1 buổi tập 1:1 cùng Huấn luyện viên cá nhân. Vui lòng chọn thanh toán theo giờ."
                    );
                }
                throw new BadRequestException(
                        "COACH_BOOKING_QUOTA_EXCEEDED",
                        "error.coach_booking.quota_exceeded",
                        new Object[]{monthlyQuota},
                        "Bạn đã sử dụng hết " + monthlyQuota + " lượt tập 1:1 trong tháng này của gói tập. Vui lòng chọn thanh toán theo giờ."
                );
            }
        } else {
            // Buổi trả theo giờ được thanh toán tại quầy; giới hạn số buổi chưa trả để tránh đặt miễn phí không giới hạn.
            if (coachBookingRepository.countUnpaid(member.getUserId()) >= MAX_UNPAID_UPCOMING) {
                throw new ConflictException("COACH_BOOKING_UNPAID_LIMIT", "error.coach_booking.unpaid_limit",
                        new Object[]{MAX_UNPAID_UPCOMING}, "Please settle your unpaid 1:1 sessions first.");
            }
            paymentStatus = "pending";
        }

        Discipline discipline = null;
        if (request.disciplineId() != null) {
            discipline = disciplineRepository.findById(request.disciplineId()).orElse(null);
        }

        CoachBooking booking = new CoachBooking();
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setDiscipline(discipline);
        booking.setSubscription(usedSubscription);
        booking.setBookingDate(request.bookingDate());
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        // Buổi 1:1 mua thêm được giảm giá cho hạng Gold (10%) và Platinum (20%); mức giá sau giảm là số tiền thực thu.
        int ptDiscount = "package_quota".equalsIgnoreCase(paymentMethod) || memberDiscounts == null
                ? 0 : memberDiscounts.percentFor(member.getUserId());
        booking.setHourlyRate(MemberDiscountService.apply(DEFAULT_HOURLY_RATE, ptDiscount));
        booking.setPaymentMethod(paymentMethod);
        booking.setPaymentStatus(paymentStatus);
        booking.setStatus("confirmed");
        booking.setNotes(request.notes());

        CoachBooking saved = coachBookingRepository.save(booking);

        Long pendingPaymentId = null;
        if (!"package_quota".equalsIgnoreCase(paymentMethod) && paymentRepository != null) {
            com.swp391.scms.finance.entity.Payment pendingPayment = new com.swp391.scms.finance.entity.Payment();
            pendingPayment.setMember(member);
            pendingPayment.setAmount(saved.getHourlyRate() != null ? saved.getHourlyRate() : DEFAULT_HOURLY_RATE);
            pendingPayment.setMethod(paymentMethod);
            pendingPayment.setStatus("pending");
            pendingPayment.setNote("PT #" + saved.getId()
                    + (ptDiscount > 0 ? " (giảm " + ptDiscount + "%, giá gốc " + DEFAULT_HOURLY_RATE.toPlainString() + ")" : ""));
            pendingPayment.setCoachBookingId(saved.getId());
            com.swp391.scms.finance.entity.Payment savedPayment = paymentRepository.save(pendingPayment);
            if (savedPayment != null) {
                pendingPaymentId = savedPayment.getId();
            }
        }

        // Thông báo cho HLV về lịch đặt riêng 1:1 mới
        if (coach.getUser() != null && notificationService != null) {
            String memberName = member.getUser() != null ? member.getUser().getFullName() : "Hội viên";
            String title = msg("notifications.coaching.booking.coach.title");
            String message = msg("notifications.coaching.booking.coach.body",
                    memberName, saved.getBookingDate(), saved.getStartTime().toString().substring(0, 5), saved.getEndTime().toString().substring(0, 5));
            notificationService.send(coach.getUserId(), title, message, "system", null, saved.getId(), "/coach/classes");
        }

        // Thông báo cho hội viên về việc đặt lịch thành công (hoặc chờ thanh toán đối với buổi trả theo giờ)
        if (member.getUser() != null && notificationService != null) {
            String coachName = coach.getUser() != null ? coach.getUser().getFullName() : "Huấn luyện viên";
            String startStr = saved.getStartTime().toString().substring(0, 5);
            String endStr = saved.getEndTime().toString().substring(0, 5);
            if ("pending".equalsIgnoreCase(paymentStatus)) {
                BigDecimal amount = saved.getHourlyRate() != null ? saved.getHourlyRate() : DEFAULT_HOURLY_RATE;
                String title = msg("notifications.coaching.booking.payment_pending.title");
                String message = msg("notifications.coaching.booking.payment_pending.body",
                        coachName, saved.getBookingDate(), startStr, endStr, amount.stripTrailingZeros().toPlainString());
                notificationService.send(
                        member.getUserId(),
                        title,
                        message,
                        "payment",
                        "payment",
                        pendingPaymentId != null ? pendingPaymentId : saved.getId(),
                        "/member/classes?tab=pt"
                );
            } else {
                String title = msg("notifications.coaching.booking.member.title");
                String message = msg("notifications.coaching.booking.member.body",
                        coachName, saved.getBookingDate(), startStr, endStr);
                notificationService.send(member.getUserId(), title, message, "system", null, saved.getId(), "/member/classes?tab=pt");
            }
        }

        return mapToDto(saved);
    }

    /** Các buổi PT của hội viên. */
    @Transactional(readOnly = true)
    public List<CoachBookingDto> getMemberBookings(Long memberId) {
        return coachBookingRepository.findByMemberId(memberId).stream()
                .map(this::mapToDto)
                .toList();
    }

    /** Khoảng ngày tối đa mà màn điểm danh được phép đọc trong một lần truy vấn. */
    public static final int MAX_ATTENDANCE_DAYS = 62;

    /**
     * Danh sách buổi PT 1:1 kèm trạng thái đến tập cho màn điểm danh trong khoảng ngày (tối đa 62 ngày): HLV chỉ
     * xem buổi của mình, lễ tân và quản lý xem tất cả. {@code outcome} gồm ATTENDED (đã đến), MISSED (kết thúc mà
     * không có ghi nhận đến), UPCOMING (sắp tới) hoặc ALL (tất cả), kèm giờ quét cổng để gợi ý.
     */
    @Transactional(readOnly = true)
    public List<CoachBookingDto> getAttendance(AuthenticatedPrincipal principal, LocalDate from, LocalDate to, String outcome) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        boolean coach = "COACH".equals(role);
        if (!coach && !DESK_ROLES.contains(role) && !"CENTER_MANAGER".equals(role) && !"MANAGER".equals(role)) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only coaches, the front desk and managers can read attendance.");
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(com.swp391.scms.common.CenterTime.ZONE));
        LocalDate end = to != null ? to : now.toLocalDate();
        LocalDate start = from != null ? from : end.minusDays(13);
        if (start.isAfter(end) || java.time.temporal.ChronoUnit.DAYS.between(start, end) > MAX_ATTENDANCE_DAYS) {
            throw new BadRequestException("COACH_BOOKING_ATTENDANCE_RANGE", "error.coach_booking.attendance_range",
                    new Object[]{MAX_ATTENDANCE_DAYS}, "The date range is invalid or longer than " + MAX_ATTENDANCE_DAYS + " days.");
        }
        String wanted = outcome == null || outcome.isBlank() ? "ALL" : outcome.trim().toUpperCase(java.util.Locale.ROOT);
        List<CoachBooking> rows = coach
                ? coachBookingRepository.findForAttendanceByCoach(principal.id(), start, end)
                : coachBookingRepository.findForAttendance(start, end);
        return rows.stream()
                .filter(b -> "ALL".equals(wanted) || wanted.equals(attendanceOutcome(b, now)))
                .map(b -> mapToDto(b, ptAttendance != null ? ptAttendance.gateCheckinFor(b) : null))
                .toList();
    }

    /**
     * HLV (đối với buổi của mình), lễ tân hoặc quản lý ghi nhận hội viên đã đến buổi PT; quét cổng chỉ hiển thị như
     * gợi ý và không bao giờ tự ghi nhận. Buổi phải đã bắt đầu và chưa hủy; đánh dấu lại buổi đã ghi nhận không làm
     * thay đổi gì.
     */
    @Transactional
    @com.swp391.scms.audit.Audited(action = "PT_ATTENDANCE_MARK", entity = "coach_bookings")
    public CoachBookingDto markAttended(AuthenticatedPrincipal principal, Long bookingId) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        boolean coach = "COACH".equals(role);
        if (!coach && !DESK_ROLES.contains(role) && !"MANAGER".equals(role)) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only coaches, the front desk and managers can mark attendance.");
        }
        CoachBooking booking = coachBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("CoachBooking", bookingId));
        if (coach && (booking.getCoach() == null || !principal.id().equals(booking.getCoach().getUserId()))) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "A coach can mark only their own sessions.");
        }
        if ("cancelled".equalsIgnoreCase(booking.getStatus())) {
            throw new ConflictException("COACH_BOOKING_CANCELLED", "error.coach_booking.already_cancelled", null,
                    "A cancelled session has no attendance.");
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(com.swp391.scms.common.CenterTime.ZONE));
        if (LocalDateTime.of(booking.getBookingDate(), booking.getStartTime()).isAfter(now)) {
            throw new BadRequestException("COACH_BOOKING_NOT_STARTED", "error.coach_booking.attendance_not_started", null,
                    "Attendance can be marked once the session has started.");
        }
        LocalDate today = now.toLocalDate();
        if (coach && !booking.getBookingDate().isEqual(today)) {
            throw new BadRequestException("COACH_BOOKING_ATTENDANCE_EXPIRED", "error.coach_booking.attendance_same_day_only", null,
                    "Coaches can only mark attendance on the day of the session.");
        }
        if (booking.getAttendedAt() == null) {
            booking.setAttendedAt(now);
            booking.setAttendanceLocked(false);
            coachBookingRepository.save(booking);
        }
        return mapToDto(booking);
    }

    /**
     * Nhân viên gỡ bỏ ghi nhận đến buổi đã đánh dấu nhầm. Buổi được gắn cờ (attendanceLocked) để danh sách thể hiện
     * rõ việc gỡ dấu là chủ đích; đánh dấu lại thủ công sẽ xóa cờ này. HLV chỉ thao tác trong ngày diễn ra buổi tập;
     * lễ tân và quản lý vẫn chỉnh được các ngày trước.
     */
    @Transactional
    @com.swp391.scms.audit.Audited(action = "PT_ATTENDANCE_UNMARK", entity = "coach_bookings")
    public CoachBookingDto unmarkAttended(AuthenticatedPrincipal principal, Long bookingId) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        boolean coach = "COACH".equals(role);
        if (!coach && !DESK_ROLES.contains(role) && !"MANAGER".equals(role)) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only coaches, the front desk and managers can change attendance.");
        }
        CoachBooking booking = coachBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("CoachBooking", bookingId));
        if (coach && (booking.getCoach() == null || !principal.id().equals(booking.getCoach().getUserId()))) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "A coach can change only their own sessions.");
        }
        if ("cancelled".equalsIgnoreCase(booking.getStatus())) {
            throw new ConflictException("COACH_BOOKING_CANCELLED", "error.coach_booking.already_cancelled", null,
                    "A cancelled session has no attendance.");
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(com.swp391.scms.common.CenterTime.ZONE));
        LocalDate today = now.toLocalDate();
        if (coach && !booking.getBookingDate().isEqual(today)) {
            throw new BadRequestException("COACH_BOOKING_ATTENDANCE_EXPIRED", "error.coach_booking.attendance_same_day_only", null,
                    "Coaches can only change attendance on the day of the session.");
        }
        if (booking.getAttendedAt() != null || !booking.isAttendanceLocked()) {
            booking.setAttendedAt(null);
            booking.setAttendanceLocked(true);
            coachBookingRepository.save(booking);
        }
        return mapToDto(booking);
    }

    /**
     * Kết quả điểm danh của buổi: ATTENDED (đã đến), MISSED (đã kết thúc mà không đến), UPCOMING (chưa bắt đầu)
     * hoặc IN_PROGRESS (đang diễn ra).
     */
    private static String attendanceOutcome(CoachBooking booking, LocalDateTime now) {
        if (booking.getAttendedAt() != null) return "ATTENDED";
        LocalDateTime end = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());
        if (!end.isAfter(now)) return "MISSED";
        LocalDateTime start = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        return start.isAfter(now) ? "UPCOMING" : "IN_PROGRESS";
    }

    /** Lịch dạy PT của HLV. */
    @Transactional(readOnly = true)
    public List<CoachBookingDto> getCoachSchedule(Long coachUserId) {
        return coachBookingRepository.findByCoachId(coachUserId).stream()
                .map(this::mapToDto)
                .toList();
    }

    /**
     * Hủy buổi PT (hội viên của buổi, HLV của buổi hoặc quản lý): chặn khi có lượt VNPay chờ; buổi đã bắt
     * đầu/hoàn thành không hủy được. Hội viên tự hủy muộn (dưới 2 giờ) buổi dùng lượt gói thì mất lượt. Khoản
     * thu chờ chuyển failed, khoản đã trả được hoàn vào ví; báo cho HLV.
     */
    @Transactional
    public CoachBookingDto cancelBooking(AuthenticatedPrincipal principal, Long bookingId, String reason) {
        CoachBooking booking = coachBookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("CoachBooking", bookingId));
        if (!booking.getMember().getUserId().equals(principal.id()) && !"CENTER_MANAGER".equalsIgnoreCase(principal.role()) && !("COACH".equalsIgnoreCase(principal.role()) && booking.getCoach().getUserId().equals(principal.id()))) {
            throw new ForbiddenException("FORBIDDEN", "error.coach_booking.forbidden_cancel", null, "You cannot cancel this booking.");
        }

        if (vnpayGuard != null) vnpayGuard.coach(bookingId);

        if ("cancelled".equalsIgnoreCase(booking.getStatus())) {
            throw new BadRequestException("ALREADY_CANCELLED", "error.coach_booking.already_cancelled", null, "Lịch này đã được hủy trước đó.");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        // Buổi đã diễn ra (hoặc đã bắt đầu) thuộc về lịch sử điểm danh, hạn mức và doanh thu.
        if ("completed".equalsIgnoreCase(booking.getStatus()) || booking.getBookingDate() == null
                || booking.getStartTime() == null
                || !LocalDateTime.of(booking.getBookingDate(), booking.getStartTime()).isAfter(now)) {
            throw new BadRequestException("COACH_BOOKING_CANCEL_TOO_LATE", "error.coach_booking.cancel_too_late", null,
                    "A 1:1 session that has started can no longer be cancelled.");
        }

        LocalDateTime sessionStart = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        boolean cancelledByStaff = "CENTER_MANAGER".equalsIgnoreCase(principal.role())
                || ("COACH".equalsIgnoreCase(principal.role()) && booking.getCoach().getUserId().equals(principal.id()));
        boolean inTimeForQuotaRefund = !sessionStart.isBefore(now.plusMinutes(ADVANCE_MINUTES_REQUIRED));
        if (!cancelledByStaff
                && "package_quota".equalsIgnoreCase(booking.getPaymentMethod())
                && !inTimeForQuotaRefund) {
            booking.setQuotaForfeited(true);
        }

        BigDecimal refundedTotal = BigDecimal.ZERO;
        if (paymentRepository != null) {
            for (var payment : paymentRepository.findAllByCoachBookingId(bookingId)) {
                if ("pending".equals(payment.getStatus())) {
                    payment.setStatus("failed");
                } else if ("success".equals(payment.getStatus())) {
                    BigDecimal refundable = payment.netAmount();
                    if (refundable != null && refundable.compareTo(BigDecimal.ZERO) > 0) {
                        payment.setRefundedAmount(payment.getAmount());
                        payment.setStatus("refunded");
                        refundedTotal = refundedTotal.add(refundable);
                    }
                }
            }
        }
        if (refundedTotal.compareTo(BigDecimal.ZERO) > 0 && walletService != null
                && booking.getMember() != null && booking.getMember().getUserId() != null) {
            walletService.creditCoachBookingRefund(
                    booking.getMember().getUserId(),
                    refundedTotal,
                    "COACH_REFUND_" + booking.getId(),
                    reason
            );
        }
        booking.setStatus("cancelled");
        booking.setCancelledAt(LocalDateTime.now(clock));
        booking.setCancelReason(reason != null ? reason : "Hội viên yêu cầu hủy");

        // Thông báo cho HLV về việc hủy lịch
        if (booking.getCoach() != null && booking.getCoach().getUser() != null && notificationService != null) {
            String memberName = booking.getMember().getUser() != null ? booking.getMember().getUser().getFullName() : "Hội viên";
            String title = msg("notifications.coaching.booking.cancelled.title");
            String message = msg("notifications.coaching.booking.cancelled.body",
                    memberName, booking.getBookingDate(), booking.getStartTime().toString().substring(0, 5), booking.getEndTime().toString().substring(0, 5));
            notificationService.send(booking.getCoach().getUserId(), title, message, "system", null, booking.getId(), "/coach/classes");
        }

        return mapToDto(booking);
    }

    /**
     * Giải phóng các khung giờ PT 1:1 bị giữ bởi booking chưa thanh toán quá {@link #UNPAID_HOLD_MINUTES} phút, hoặc
     * vẫn chưa thanh toán trong vòng {@link #UNPAID_RELEASE_LEAD_MINUTES} phút trước giờ bắt đầu (sau khi đã giữ ít
     * nhất {@link #UNPAID_MIN_HOLD_MINUTES} phút). Mỗi booking được xử lý trong một transaction độc lập có khóa dòng
     * {@code FOR UPDATE} để đọc lại trạng thái thanh toán mới nhất và không bao giờ ghi đè buổi vừa được thanh toán
     * hoặc kéo rollback các booking khác khi xảy ra lỗi.
     */
    public int expireUnpaidBookings() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime createdCutoff = now.minusMinutes(UNPAID_HOLD_MINUTES);
        LocalDateTime minHoldCutoff = now.minusMinutes(UNPAID_MIN_HOLD_MINUTES);
        LocalDateTime releaseDueAt = now.plusMinutes(UNPAID_RELEASE_LEAD_MINUTES);
        List<CoachBooking> stale = coachBookingRepository.findUnpaidStale(
                createdCutoff, minHoldCutoff, releaseDueAt.toLocalDate(), releaseDueAt.toLocalTime());
        int cancelled = 0;
        for (CoachBooking candidate : stale) {
            if (candidate == null || candidate.getId() == null) {
                continue;
            }
            try {
                Boolean expired;
                if (transactionManager != null) {
                    var template = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
                    template.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                    expired = template.execute(status -> expireSingleUnpaidBooking(candidate.getId(), now));
                } else {
                    expired = expireSingleUnpaidBooking(candidate.getId(), now);
                }
                if (Boolean.TRUE.equals(expired)) {
                    cancelled++;
                }
            } catch (RuntimeException ex) {
                log.warn("Could not expire unpaid 1:1 PT booking {}: {}", candidate.getId(), ex.getMessage());
            }
        }
        return cancelled;
    }

    /** Khóa một booking PT 1:1 cụ thể, kiểm tra lại trạng thái thanh toán và cổng VNPay dưới khóa rồi hủy nếu vẫn quá hạn. */
    private boolean expireSingleUnpaidBooking(Long bookingId, LocalDateTime now) {
        CoachBooking locked = coachBookingRepository.findByIdForUpdate(bookingId).orElse(null);
        if (locked == null) {
            return false;
        }
        if (entityManager != null) {
            entityManager.refresh(locked);
        }
        if (!"confirmed".equalsIgnoreCase(locked.getStatus())
                || !"pending".equalsIgnoreCase(locked.getPaymentStatus())
                || "package_quota".equalsIgnoreCase(locked.getPaymentMethod())) {
            return false;
        }
        try {
            if (vnpayGuard != null) vnpayGuard.coach(locked.getId());
        } catch (ConflictException awaitingGateway) {
            return false;
        }
        if (paymentRepository != null) {
            List<com.swp391.scms.finance.entity.Payment> bookingPayments =
                    paymentRepository.findAllByCoachBookingId(locked.getId());
            if (bookingPayments != null) {
                if (bookingPayments.stream().anyMatch(p -> "success".equalsIgnoreCase(p.getStatus()))) {
                    return false;
                }
                for (var payment : bookingPayments) {
                    if ("pending".equalsIgnoreCase(payment.getStatus())) {
                        payment.setStatus("failed");
                        paymentRepository.save(payment);
                    }
                }
            }
        }
        locked.setStatus("cancelled");
        locked.setCancelledAt(now);
        locked.setCancelReason(msg("coaching.auto_cancel.unpaid"));
        coachBookingRepository.save(locked);
        if (notificationService != null && locked.getMember() != null && locked.getMember().getUserId() != null
                && locked.getStartTime() != null && locked.getEndTime() != null) {
            String title = msg("notifications.coaching.booking.auto_cancelled.title");
            String body = msg("notifications.coaching.booking.auto_cancelled.body",
                    locked.getBookingDate(),
                    locked.getStartTime().toString().substring(0, 5),
                    locked.getEndTime().toString().substring(0, 5));
            notificationService.send(locked.getMember().getUserId(), title, body, "system", null, locked.getId(), "/member/classes?tab=pt");
        }
        return true;
    }

    /**
     * Các buổi PT 1:1 trả theo giờ đang chờ quầy lễ tân thu tiền, cũ nhất trước.
     */
    @Transactional(readOnly = true)
    public List<CoachBookingDto> getUnpaidBookings(AuthenticatedPrincipal principal) {
        requireDesk(principal);
        return coachBookingRepository.findUnpaid().stream().map(this::mapToDto).toList();
    }

    /**
     * Quầy lễ tân ghi nhận buổi PT 1:1 theo giờ đã được thanh toán: chặn khi có lượt VNPay đang chờ; đánh dấu booking
     * đã trả và ghi khoản thu thành công (tái sử dụng khoản đang chờ nếu có) để tiền hiển thị trong báo cáo doanh thu,
     * đồng thời tự động xuất hóa đơn.
     */
    @Transactional
    public CoachBookingDto confirmHourlyPayment(AuthenticatedPrincipal principal, Long bookingId, String method) {
        requireDesk(principal);
        CoachBooking booking = coachBookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach_booking", bookingId));
        if (vnpayGuard != null) vnpayGuard.coach(bookingId);
        if ("package_quota".equalsIgnoreCase(booking.getPaymentMethod())
                || !"pending".equalsIgnoreCase(booking.getPaymentStatus())
                || "cancelled".equalsIgnoreCase(booking.getStatus())) {
            throw new ConflictException("COACH_BOOKING_PAYMENT_NOT_PENDING",
                    "error.coach_booking.payment_not_pending", null, "This 1:1 session has no payment to collect.");
        }
        String paidWith = method == null || method.isBlank()
                ? "cash" : method.trim().toLowerCase(java.util.Locale.ROOT);
        if (!ALLOWED_PAYMENT_METHODS.contains(paidWith) || "package_quota".equals(paidWith)) {
            throw new BadRequestException("INVALID_PAYMENT_METHOD", "error.coach_booking.invalid_payment_method", null,
                    "Unsupported payment method.");
        }
        booking.setPaymentMethod(paidWith);
        booking.setPaymentStatus("paid");
        Long savedPaymentId = null;
        if (paymentRepository != null) {
            com.swp391.scms.finance.entity.Payment payment = new com.swp391.scms.finance.entity.Payment();
            payment.setMember(booking.getMember());
            payment.setAmount(booking.getHourlyRate() != null ? booking.getHourlyRate() : DEFAULT_HOURLY_RATE);
            payment.setMethod(paidWith);
            payment.setStatus("success");
            payment.setPaidAt(LocalDateTime.now(clock));
            payment.setNote("PT #" + booking.getId());
            payment.setCoachBookingId(booking.getId());
            if (userRepository != null) {
                userRepository.findByIdAndDeletedAtIsNull(principal.id()).ifPresent(payment::setReceivedBy);
            }
            var existing = paymentRepository.findAllByCoachBookingId(bookingId);
            com.swp391.scms.finance.entity.Payment persisted;
            if (existing != null && !existing.isEmpty()) {
                if (existing.size() != 1 || !"pending".equals(existing.getFirst().getStatus()))
                    throw new ConflictException("VNPAY_TARGET_UNAVAILABLE", "finance.vnpay.target_unavailable", null, null);
                var pending = existing.getFirst();
                pending.setMethod(payment.getMethod()); pending.setStatus("success");pending.setPaidAt(payment.getPaidAt());pending.setReceivedBy(payment.getReceivedBy());
                persisted = paymentRepository.save(pending);
            } else {
                persisted = paymentRepository.save(payment);
            }
            if (persisted != null) {
                savedPaymentId = persisted.getId();
            }
            if (invoiceService != null && savedPaymentId != null) {
                try {
                    invoiceService.autoIssueInvoiceForPayment(savedPaymentId);
                } catch (RuntimeException ignored) {
                }
            }
        }
        if (booking.getMember() != null && booking.getMember().getUserId() != null && notificationService != null) {
            String coachName = booking.getCoach() != null && booking.getCoach().getUser() != null
                    ? booking.getCoach().getUser().getFullName() : "Huấn luyện viên";
            String startStr = booking.getStartTime() != null ? booking.getStartTime().toString().substring(0, 5) : "";
            String endStr = booking.getEndTime() != null ? booking.getEndTime().toString().substring(0, 5) : "";
            BigDecimal amount = booking.getHourlyRate() != null ? booking.getHourlyRate() : DEFAULT_HOURLY_RATE;
            String title = msg("notifications.coaching.booking.payment_confirmed.title");
            String message = msg("notifications.coaching.booking.payment_confirmed.body",
                    coachName, booking.getBookingDate(), startStr, endStr, amount.stripTrailingZeros().toPlainString());
            notificationService.send(
                    booking.getMember().getUserId(),
                    title,
                    message,
                    "payment",
                    "payment",
                    savedPaymentId != null ? savedPaymentId : booking.getId(),
                    "/member/classes?tab=pt"
            );
        }
        return mapToDto(booking);
    }

    /** Chỉ lễ tân hoặc quản lý trung tâm được thao tác quầy. */
    private static void requireDesk(AuthenticatedPrincipal principal) {
        if (principal == null || principal.role() == null
                || !DESK_ROLES.contains(principal.role().toUpperCase(java.util.Locale.ROOT))) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only the front desk can collect 1:1 payments.");
        }
    }

    /** Chuyển buổi PT sang DTO (không kèm giờ quét cổng). */
    private CoachBookingDto mapToDto(CoachBooking b) {
        return mapToDto(b, null);
    }

    /**
     * Chuyển buổi PT sang DTO kèm thông tin HLV, bộ môn, thanh toán, điểm danh, giờ quét cổng và liên hệ hội
     * viên.
     */
    private CoachBookingDto mapToDto(CoachBooking b, LocalDateTime gateCheckinAt) {
        return new CoachBookingDto(
                b.getId(),
                b.getMember().getUserId(),
                b.getMember().getUser() != null ? b.getMember().getUser().getFullName() : "Hội viên",
                b.getCoach().getUserId(),
                b.getCoach().getUser() != null ? b.getCoach().getUser().getFullName() : "HLV",
                b.getCoach().getSpecialization(),
                b.getCoach().getUser() != null ? b.getCoach().getUser().getAvatarUrl() : null,
                b.getDiscipline() != null ? b.getDiscipline().getId() : null,
                b.getDiscipline() != null ? b.getDiscipline().getName() : null,
                b.getBookingDate(),
                b.getStartTime(),
                b.getEndTime(),
                b.getHourlyRate(),
                b.getPaymentMethod(),
                b.getPaymentStatus(),
                b.getStatus(),
                b.getNotes(),
                b.getCreatedAt(),
                b.getCancelledAt(),
                b.getCancelReason(),
                b.getAttendedAt(),
                b.isAttendanceLocked(),
                gateCheckinAt,
                b.getMember() != null ? b.getMember().getMembershipCode() : null,
                b.getMember() != null && b.getMember().getUser() != null ? b.getMember().getUser().getPhone() : null,
                b.getMember() != null && b.getMember().getUser() != null ? b.getMember().getUser().getEmail() : null
        );
    }
    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }
}
