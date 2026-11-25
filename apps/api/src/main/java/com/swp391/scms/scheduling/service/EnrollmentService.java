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
import com.swp391.scms.scheduling.dto.EnrollmentResponses.UnpaidCourseEnrollmentDto;
import com.swp391.scms.finance.dto.PaymentDto;
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
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;
import java.util.Objects;

/**
 * SCRUM-73 & SCRUM-132: Nghiệp vụ ghi danh khóa học của hội viên, chặn chồng giờ, thanh toán, hủy khóa, xử lý
 * khi bảo lưu gói, đóng lớp và hết hạn thanh toán.
 *
 * <p>Các trigger bất biến thuộc về database và không bao giờ bị bỏ qua: Trigger P2
 * ({@code trg_enrollments_check_capacity}) từ chối lớp đã đầy và Trigger P4
 * ({@code trg_enrollments_check_membership}) từ chối gói hội viên không hoạt động/hết hạn. Cả hai được phản
 * chiếu thành bước kiểm tra trước để API trả lỗi chính xác thay vì lỗi ràng buộc thô.
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

    /** Gán giá trị mới cho trường wallets. */
    public void setWallets(com.swp391.scms.wallet.WalletService wallets) {
        this.wallets = wallets;
    }

    @Autowired(required = false)
    private com.swp391.scms.users.UserRepository userRepository;

    /** Gán giá trị mới cho trường userRepository. */
    public void setUserRepository(com.swp391.scms.users.UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.swp391.scms.finance.service.PaymentService paymentService;

    /** Gán giá trị mới cho trường paymentService. */
    public void setPaymentService(com.swp391.scms.finance.service.PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    private static final Set<String> COUNTER_PAYMENT_METHODS = Set.of("cash", "bank_transfer");

    /** Phí khóa học trả online (ví/VNPay) giữ chỗ trong khoảng này; phí tiền mặt giữ đến khi khóa bắt đầu. */
    public static final long ONLINE_HOLD_MINUTES = 15;

    /** Gán giá trị mới cho trường memberDiscounts. */
    public void setMemberDiscounts(MemberDiscountService memberDiscounts) {
        this.memberDiscounts = memberDiscounts;
    }

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.swp391.scms.finance.service.VnpayPaymentService vnpayPaymentService;

    /** Gán giá trị mới cho trường paymentRepository. */
    public void setPaymentRepository(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    /** Gán giá trị mới cho trường vnpayPaymentService. */
    public void setVnpayPaymentService(com.swp391.scms.finance.service.VnpayPaymentService vnpayPaymentService) {
        this.vnpayPaymentService = vnpayPaymentService;
    }

    /** Chặn nhả phí khóa học trong lúc cổng VNPay vẫn có thể tất toán một lần thử của nó. */
    @Autowired(required = false)
    private com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    /** Gán giá trị mới cho trường vnpayGuard. */
    public void setVnpayGuard(com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard) {
        this.vnpayGuard = vnpayGuard;
    }

    /**
     * Khởi tạo service với các repository bắt buộc, NotificationService, MessageService và Clock; các phụ thuộc
     * tùy chọn được inject qua field.
     */
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

    /** Dịch message key kèm tham số; không có MessageService thì trả lại key. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Ghi danh cả lớp theo kiểu cũ (giữ một chỗ ở mọi buổi): kiểm tra lớp active, buổi còn mở, gói tập, chưa
     * ghi danh, không trùng lịch và còn chỗ.
     *
     * Ghi danh toàn lớp (cũ): giữ một chỗ ở mọi buổi của lớp. Đặt chỗ mới thực hiện theo buổi qua {@link
     * SessionBookingService}; phần này còn lại cho các ghi danh và client API hiện có. Từ chối đặt chồng giờ
     * ở các lớp khác nhau trong cùng khung giờ.
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
     * Chặn ghi danh nếu hội viên đã có lớp khác (đang booked) có buổi trùng giờ với buổi mục tiêu; bỏ qua lớp
     * excludeClassId.
     *
     * SCRUM-132: Từ chối lượt đặt nếu hội viên đã giữ lượt đặt đang hoạt động ở lớp khác có buổi đã xếp chồng
     * giờ.
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

    /**
     * Số lượt đặt chỗ lớn nhất trong một buổi bất kỳ của lớp.
     *
     * Số lượt đặt theo buổi cao nhất ở bất kỳ buổi nào của lớp.
     */
    private long busiestSession(Long classId) {
        if (sessionBookings == null) return 0;
        return sessionBookings.countBookedGroupedBySession(classId).stream()
                .mapToLong(com.swp391.scms.scheduling.dto.SessionBookingCount::bookedCount).max().orElse(0);
    }

    /** Định dạng giờ thành chuỗi HH:mm (null thành chuỗi rỗng). */
    private static String formatTime(LocalTime time) {
        if (time == null) return "";
        String raw = time.toString();
        return raw.length() >= 5 ? raw.substring(0, 5) : raw;
    }

    /**
     * Hủy một lượt ghi danh (soft delete, nhả chỗ ngay): khóa lớp và lượt, chỉ chủ sở hữu hoặc nhân viên, lượt
     * phải booked; hội viên không tự hủy khóa đã bắt đầu; hủy khoản phí chưa trả và gửi thông báo.
     *
     * SCRUM-73 BR-05: hủy một lượt đặt. Xóa mềm, nhả chỗ ngay lập tức. Chỉ chủ lượt đặt hoặc Staff/Manager
     * được hủy.
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

        // Hội viên không thể bỏ một khóa học đã bắt đầu (lượt sẽ được hoàn lại và phí vẫn phải trả); quầy lễ
        // tân vẫn hủy thay được.
        GymClass enrolledClass = enrollment.getGymClass();
        if (!isStaff && enrolledClass != null && enrolledClass.getStartDate() != null
                && !enrolledClass.getStartDate().isAfter(SessionEligibility.today(clock))) {
            throw new BadRequestException("SCHEDULING_CANNOT_CANCEL_STARTED_COURSE",
                    "error.scheduling.cannot_cancel_started_course", null,
                    "Không thể hủy khóa học đã hoặc đang bắt đầu");
        }

        // Nhả chỗ trong lúc VNPay còn có thể xác nhận phí sẽ lấy tiền của hội viên mà không đem lại gì.
        if (vnpayGuard != null) vnpayGuard.enrollment(enrollment.getId());

        LocalDateTime now = LocalDateTime.now(clock);
        enrollment.setStatus(CANCELLED);
        enrollment.setCancelledAt(now);
        enrollment.setCancelReason(msg("scheduling.enrollment.cancelled_by_role", principal.role()));

        // Phí khóa học chưa trả không được còn thanh toán được sau khi chỗ đã nhả.
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
     * Hủy các lượt đặt lớp sắp tới của hội viên mà ngày buổi kế tiếp không thỏa {@code coveredOn} (một điều kiện
     * luôn false sẽ hủy toàn bộ, ví dụ khi bảo lưu hoặc hủy gói); khóa hội viên và các lớp theo thứ tự tăng dần
     * để tránh deadlock; trả về số lượt đã hủy.
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

        // Tạm hoãn/hủy membership đã nắm khóa này; các lời gọi độc lập cũng dùng nó.
        lockMember(memberId);
        List<Long> classIds = enrollments.findBookedClassIdsByMemberId(memberId).stream()
                .distinct().sorted().toList();
        // Khóa các lớp theo thứ tự tăng dần trước khi nạp trạng thái ghi danh có thể thay đổi.
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

    /** Tạm hoãn được duyệt ít nhất số ngày này trước khi khóa bắt đầu sẽ trả lại lượt hoặc phí. */
    public static final int HOLD_REFUND_NOTICE_DAYS = 3;

    /**
     * Kết quả áp dụng bảo lưu gói lên các khóa học: số lượt hủy, credit được trả lại, credit bị mất và số tiền
     * hoàn.
     *
     * Việc tạm hoãn membership đã tác động gì lên các ghi danh khóa học của hội viên.
     */
    public record CourseHoldOutcome(int cancelled, int creditsRestored, int creditsLost, BigDecimal refunded) {
        public static final CourseHoldOutcome NONE = new CourseHoldOutcome(0, 0, 0, BigDecimal.ZERO);
    }

    /**
     * Áp dụng bảo lưu gói hội viên đã duyệt lên các ghi danh khóa học của hội viên. Bảo lưu được duyệt ít nhất
     * {@value #HOLD_REFUND_NOTICE_DAYS} ngày trước khi khóa bắt đầu sẽ khôi phục lượt miễn phí hoặc hoàn đủ phí
     * đã thanh toán vào ví; bảo lưu muộn hơn hoặc khi khóa đã chạy thì mất lượt hoặc phí. Mọi ghi danh bị ảnh
     * hưởng đều bị hủy. Với {@code to == null} (bảo lưu mở) mọi khóa chưa kết thúc bị ảnh hưởng; với bảo lưu có
     * ngày thì chỉ các khóa còn buổi nằm trong {@code from..to}.
     */
    @Transactional
    public CourseHoldOutcome releaseCoursesForHold(Long memberId, String cancelReason, LocalDate from, LocalDate to) {
        if (memberId == null || enrollments == null) {
            return CourseHoldOutcome.NONE;
        }
        String resolvedReason = (cancelReason != null && !cancelReason.isBlank())
                ? cancelReason
                : msg("scheduling.enrollment.cancelled_by_hold");
        lockMember(memberId);
        List<Long> classIds = enrollments.findBookedClassIdsByMemberId(memberId).stream()
                .distinct().sorted().toList();
        List<GymClass> lockedClasses = classIds.stream().map(this::lockClass).toList();
        LocalDateTime now = SessionEligibility.now(clock);
        LocalDate today = now.toLocalDate();
        LocalTime nowTime = now.toLocalTime();
        int cancelled = 0;
        int restored = 0;
        int lost = 0;
        BigDecimal refunded = BigDecimal.ZERO;
        for (GymClass gymClass : lockedClasses) {
            java.util.Optional<LocalDate> nextSession = nextOpenSessionDate(gymClass, today, nowTime);
            if (nextSession.isEmpty() || (to != null && !hasOpenSessionBetween(gymClass, from, to))) {
                continue;
            }
            var booking = enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), memberId, BOOKED);
            if (booking.isEmpty()) {
                continue;
            }
            ClassEnrollment enrollment = booking.get();
            LocalDate courseStart = gymClass.getStartDate() != null ? gymClass.getStartDate() : nextSession.get();
            boolean inTime = !courseStart.isBefore(today.plusDays(HOLD_REFUND_NOTICE_DAYS));
            Payment payment = paymentRepository != null
                    ? paymentRepository.findByClassEnrollmentId(enrollment.getId()).orElse(null) : null;
            if (payment != null && "pending".equalsIgnoreCase(payment.getStatus())) {
                try {
                    if (vnpayGuard != null) vnpayGuard.enrollment(enrollment.getId());
                } catch (RuntimeException awaitingGateway) {
                    continue; // Cổng thanh toán vẫn có thể tất toán khoản phí này: giữ lại chỗ cho lượt quét hết hạn.
                }
            }

            enrollment.setStatus(CANCELLED);
            enrollment.setCancelledAt(now);
            enrollment.setCancelReason(resolvedReason);
            String bodyKey;
            Object[] bodyArgs;
            BigDecimal refund = BigDecimal.ZERO;
            if (payment != null && "pending".equalsIgnoreCase(payment.getStatus())) {
                payment.setStatus("failed");
                paymentRepository.save(payment);
                bodyKey = "notifications.membership.course_hold.cancelled.body";
                bodyArgs = new Object[]{gymClass.getName()};
            } else if (payment != null && "success".equalsIgnoreCase(payment.getStatus())
                    && payment.netAmount().signum() > 0) {
                if (inTime) {
                    refund = refundCoursePayment(payment, memberId, enrollment.getId(), "Membership hold");
                    refunded = refunded.add(refund);
                    bodyKey = "notifications.membership.course_hold.refunded.body";
                    bodyArgs = new Object[]{gymClass.getName(), refund.toPlainString()};
                } else {
                    lost++;
                    bodyKey = "notifications.membership.course_hold.fee_lost.body";
                    bodyArgs = new Object[]{gymClass.getName(), HOLD_REFUND_NOTICE_DAYS};
                }
            } else if (inTime) {
                restored++;
                bodyKey = "notifications.membership.course_hold.credit_restored.body";
                bodyArgs = new Object[]{gymClass.getName()};
            } else {
                enrollment.setCreditForfeited(true);
                lost++;
                bodyKey = "notifications.membership.course_hold.credit_lost.body";
                bodyArgs = new Object[]{gymClass.getName(), HOLD_REFUND_NOTICE_DAYS};
            }
            ClassEnrollment saved = enrollments.saveAndFlush(enrollment);
            cancelled++;
            if (notifications != null) {
                notifications.send(memberId, msg("notifications.booking.cancelled.title"), msg(bodyKey, bodyArgs),
                        "system", "class_enrollment", saved.getId());
            }
        }
        return new CourseHoldOutcome(cancelled, restored, lost, refunded);
    }

    /**
     * True nếu khóa học còn buổi chưa hủy và chưa hoàn tất nằm trong khoảng from..to (không rõ lịch thì coi như
     * có).
     *
     * True khi khóa học còn buổi chưa hủy cũng chưa hoàn thành nằm trong {@code from..to}.
     */
    private boolean hasOpenSessionBetween(GymClass gymClass, LocalDate from, LocalDate to) {
        if (gymClass == null || gymClass.getId() == null || sessions == null) return true;
        List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(gymClass.getId());
        if (classSessions == null || classSessions.isEmpty()) return true;
        return classSessions.stream()
                .filter(sess -> !"cancelled".equalsIgnoreCase(sess.getStatus())
                        && !"completed".equalsIgnoreCase(sess.getStatus()))
                .anyMatch(sess -> sess.getSessionDate() != null
                        && !sess.getSessionDate().isBefore(from) && !sess.getSessionDate().isAfter(to));
    }

    /**
     * Trung tâm đóng lớp: khoản phí chưa trả chuyển failed, khoản đã trả được hoàn toàn bộ vào ví; trả về số
     * tiền hoàn.
     *
     * Trung tâm đóng lớp: khoản phí chưa trả được đóng là failed, khoản đã thanh toán được hoàn đủ vào ví.
     * Trả về số tiền đã hoàn.
     */
    @Transactional
    public BigDecimal settleFeeOnClassClosure(ClassEnrollment enrollment, String reason) {
        if (paymentRepository == null || enrollment == null || enrollment.getId() == null || enrollment.getMember() == null) {
            return BigDecimal.ZERO;
        }
        Payment payment = paymentRepository.findByClassEnrollmentId(enrollment.getId()).orElse(null);
        if (payment == null) return BigDecimal.ZERO;
        if ("pending".equalsIgnoreCase(payment.getStatus())) {
            payment.setStatus("failed");
            paymentRepository.save(payment);
            return BigDecimal.ZERO;
        }
        if (!"success".equalsIgnoreCase(payment.getStatus()) || payment.netAmount().signum() <= 0) {
            return BigDecimal.ZERO;
        }
        return refundCoursePayment(payment, enrollment.getMember().getUserId(), enrollment.getId(), reason);
    }

    /**
     * Hoàn toàn bộ phí đã thanh toán vào ví, đánh dấu payment là refunded; trả về số tiền hoàn.
     *
     * Hoàn toàn bộ phí đã thanh toán vào ví và đánh dấu khoản thanh toán refunded; trả về số tiền đã hoàn.
     */
    private BigDecimal refundCoursePayment(Payment payment, Long memberId, Long enrollmentId, String reason) {
        BigDecimal refundable = payment.netAmount();
        payment.setRefundedAmount(payment.getAmount());
        payment.setStatus("refunded");
        paymentRepository.save(payment);
        if (wallets != null) {
            wallets.creditCourseRefund(memberId, refundable, "COURSE_REFUND_" + enrollmentId, reason);
        }
        return refundable;
    }

    /**
     * Ngày của buổi kế tiếp chưa kết thúc của lớp; không rõ lịch thì trả hôm nay, không còn buổi thì trả rỗng.
     *
     * Ngày của buổi kế tiếp chưa kết thúc của lớp; hôm nay khi chưa biết lịch, rỗng khi không có.
     */
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

    /** Lấy lớp theo id và khóa dòng (PESSIMISTIC_WRITE). */
    private GymClass lockClass(Long classId) {
        return gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
    }

    /** Lấy hội viên theo id và khóa dòng (PESSIMISTIC_WRITE). */
    private Member lockMember(Long memberId) {
        return members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
    }

    /** Overload không lọc trạng thái. */
    @Transactional(readOnly = true)
    public List<EnrollmentDto> myEnrollments(AuthenticatedPrincipal principal) {
        return myEnrollments(principal, null);
    }

    /**
     * Lấy các lượt ghi danh của hội viên đang đăng nhập, lọc theo trạng thái (không phân biệt hoa thường), kèm
     * buổi đại diện của lớp.
     */
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

        // Sau khi nâng cấp, các lượt đã dùng ở gói trước vẫn tính vào hạn mức mới.
        long used = enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(
                member.getUserId(),
                BOOKED,
                creditWindowStart(currentSub),
                currentSub.getEndDate()
        );
        // Một lượt bị mất do tạm hoãn muộn vẫn tính là đã dùng dù ghi danh đã bị hủy.
        used += enrollments.countForfeitedCreditsBetween(
                member.getUserId(), creditWindowStart(currentSub), currentSub.getEndDate());

        int total = unlimited ? 999999 : creditLimit;
        int remaining = unlimited ? 999999 : Math.max(0, creditLimit - (int) used);

        return new QuotaDto(tier, creditLimit, (int) used, remaining, unlimited, blockedUntil,
                com.swp391.scms.facilities.PackageBenefits.discountPercent(pkg));
    }

    /**
     * Ngày bắt đầu chu kỳ dùng chung credit: gói nâng cấp tiếp nối chu kỳ của gói cũ.
     *
     * Mốc bắt đầu của kỳ mà các lượt được dùng chung: nâng cấp tiếp tục gói mà nó thay thế.
     */
    private static LocalDate creditWindowStart(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        return com.swp391.scms.facilities.PackageBenefits.cycleAnchor(sub);
    }

    /**
     * Chặn ghi danh khi hội viên đang bị khóa đăng ký khóa học (do vắng quá 50% buổi của một khóa trước).
     *
     * Hội viên vắng hơn một nửa khóa học thì không được vào khóa khác cho đến khi lệnh chặn kết thúc.
     */
    private void ensureNotBlocked(Member member) {
        var until = member.getCourseEnrollBlockedUntil();
        if (until != null && until.isAfter(SessionEligibility.now(clock))) {
            throw new ForbiddenException("SCHEDULING_COURSE_ENROLL_BLOCKED", "error.scheduling.course_enroll_blocked",
                    new Object[]{until.toLocalDate().toString()},
                    "Đăng ký khóa học tạm khóa đến " + until.toLocalDate() + " do vắng quá 50% số buổi của một khóa trước.");
        }
    }

    /**
     * Ghi danh hội viên vào cả khóa định kỳ bằng credit: kiểm tra bị khóa, lớp active, khóa chưa bắt đầu, gói
     * tập phủ trọn khóa, chưa ghi danh, không trùng lịch, còn credit và còn chỗ.
     */
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
        // Cùng quy tắc với checkoutCourse: khóa học được tham gia trọn vẹn, nên khi đã bắt đầu thì đóng. Kiểm
        // tra trước để hội viên không thấy lỗi gây hiểu nhầm "membership không bao phủ <ngày bắt đầu>".
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

        // Khóa học giữ hội viên ở mọi buổi: không lớp khác, sân hay lượt đặt PT 1:1 nào được chồng lên bất kỳ
        // buổi nào.
        if (scheduleGuard != null) {
            scheduleGuard.ensureCourseFree(member.getUserId(), gymClass);
        }

        // Kiểm tra hạn mức.
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

    /**
     * Thanh toán khóa học: miễn phí nếu còn credit, nếu hết thì tính phí (giảm theo hạng thành viên) qua tiền
     * mặt, ví hoặc VNPay; ví phải đủ số dư; giữ chỗ trong lúc chờ thanh toán.
     */
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
        // Hội viên Gold và Platinum được giảm 10% / 20% phí khóa học khi đã dùng hết lượt miễn phí.
        int discountPercent = memberDiscounts != null ? memberDiscounts.percentFor(member.getUserId()) : 0;
        BigDecimal price = MemberDiscountService.apply(listPrice, discountPercent);
        String normalizedMethod = method != null ? method.toLowerCase() : "cash";
        if (!List.of("cash", "online_wallet", "vnpay").contains(normalizedMethod)) {
            normalizedMethod = "cash";
        }

        // Trả bằng ví cần có tiền ngay: không giữ chỗ cho khoản phí mà ví không đủ trả.
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
        ClassEnrollment savedEnrollment = enrollments.saveAndFlush(enrollment);
        LocalDateTime holdUntil = "cash".equals(normalizedMethod) && gymClass.getStartDate() != null
                ? gymClass.getStartDate().atStartOfDay()
                : LocalDateTime.now(clock).plusMinutes(ONLINE_HOLD_MINUTES);

        Long paymentId = null;
        boolean isFree = price.compareTo(BigDecimal.ZERO) == 0;
        String paymentStatus = isFree ? "success" : "pending";
        String paymentUrl = null;
        LocalDateTime expiresAt = null;

        if (paymentRepository != null && !isFree) {
            Payment payment = new Payment();
            payment.setMember(member);
            payment.setClassEnrollmentId(savedEnrollment.getId());
            payment.setAmount(price);
            payment.setMethod("vnpay".equals(normalizedMethod) ? "online_wallet" : normalizedMethod);
            payment.setStatus("pending");
            payment.setNote("Học phí khóa học: " + gymClass.getName()
                    + (discountPercent > 0 ? " (giảm " + discountPercent + "%, giá gốc " + listPrice.toPlainString() + ")" : ""));
            Payment savedPayment = paymentRepository.save(payment);
            paymentRepository.flush();
            paymentId = savedPayment.getId();
            expiresAt = holdUntil;

            if ("online_wallet".equals(normalizedMethod)) {
                if (vnpayPaymentService != null) {
                    vnpayPaymentService.payWithWallet(
                            principal,
                            new com.swp391.scms.finance.dto.VnpayDtos.CheckoutRequest(null, null, savedPayment.getId())
                    );
                } else if (wallets != null) {
                    wallets.debitForPayment(
                            member.getUserId(),
                            price,
                            "WALLET_PAY_" + savedPayment.getId(),
                            "Thanh toán học phí khóa học (#" + savedPayment.getId() + ")",
                            "/member/classes"
                    );
                    savedPayment.setStatus("success");
                    savedPayment.setPaidAt(LocalDateTime.now(clock));
                    paymentRepository.save(savedPayment);
                } else {
                    throw new ConflictException("WALLET_UNAVAILABLE", "error.wallet.unavailable", null,
                            "Tính năng Ví điện tử hiện không khả dụng.");
                }
                paymentStatus = "success";
                expiresAt = null;
            } else if ("vnpay".equals(normalizedMethod) && vnpayPaymentService != null && vnpayPaymentService.enabled()) {
                try {
                    String ip = "127.0.0.1";
                    String origin = null;
                    var reqAttrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
                    if (reqAttrs instanceof org.springframework.web.context.request.ServletRequestAttributes servletAttrs) {
                        var req = servletAttrs.getRequest();
                        if (req.getRemoteAddr() != null) ip = req.getRemoteAddr();
                        origin = req.getHeader("Origin") != null ? req.getHeader("Origin") : req.getHeader("Referer");
                    }
                    var checkout = vnpayPaymentService.checkout(
                            principal,
                            new com.swp391.scms.finance.dto.VnpayDtos.CheckoutRequest(null, null, savedPayment.getId()),
                            ip,
                            origin
                    );
                    paymentUrl = checkout.paymentUrl();
                } catch (Exception ex) {
                    // Khoản thanh toán vẫn ở trạng thái pending để lễ tân còn thu được; hội viên có thể thử lại
                    // online.
                    org.slf4j.LoggerFactory.getLogger(EnrollmentService.class)
                            .warn("VNPay checkout could not be created for course payment {}", savedPayment.getId(), ex);
                }
            }
        }

        if (notifications != null) {
            notifications.send(
                    member.getUserId(),
                    msg("notifications.booking.class_enrolled.title"),
                    msg("notifications.booking.course_checkout.body", gymClass.getName()),
                    "system",
                    "class_enrollment",
                    savedEnrollment.getId()
            );
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
                expiresAt
        );
    }

    /**
     * Hội viên hủy ghi danh khóa chưa bắt đầu: chặn khi VNPay có thể còn xác nhận, hủy khoản phí chưa trả và
     * hoàn phí đã trả (nếu có).
     */
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

        // Phí khóa học chưa trả không được còn thanh toán được sau khi chỗ đã nhả; phí đã thanh toán được hoàn
        // vào ví.
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
        if (notifications != null) {
            notifications.send(
                    member.getUserId(),
                    msg("notifications.booking.cancelled.title"),
                    msg("notifications.booking.cancelled.body"),
                    "system",
                    "class_enrollment",
                    saved.getId()
            );
        }
        return toDto(saved, resolveSessionForClass(gymClass));
    }

    /**
     * Nhả chỗ cho phí khóa học chưa thanh toán: phí online sau ONLINE_HOLD_MINUTES phút, phí tiền mặt khi khóa
     * bắt đầu; bỏ qua khoản VNPay còn có thể xác nhận; trả về số chỗ đã nhả.
     *
     * Giải phóng chỗ bị giữ bởi phí khóa học chưa bao giờ được trả: phí online (ví/VNPay) sau {@value
     * #ONLINE_HOLD_MINUTES} phút, phí quầy (tiền mặt) khi khóa bắt đầu. Các khoản phí cổng thanh toán vẫn có
     * thể xác nhận thì không đụng tới.
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
                // Đóng các lần thử đã quá hạn cộng thời gian ân hạn IPN; lần VNPay còn có thể tất toán thì giữ
                // phí và chỗ.
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

    /** Danh sách khóa học hội viên đang đăng nhập đã ghi danh, kèm buổi đại diện. */
    @Transactional(readOnly = true)
    public List<EnrollmentDto> getMyCourseEnrollments(AuthenticatedPrincipal principal) {
        Member member = findMember(principal.id());
        List<ClassEnrollment> list = enrollments.findByMemberUserId(member.getUserId());
        return list.stream()
                .map(e -> toDto(e, resolveSessionForClass(e.getGymClass())))
                .toList();
    }

    /**
     * Danh sách các lượt ghi danh khóa học đang giữ chỗ ({@code booked}) có khoản học phí chờ thanh toán tại
     * quầy ({@code cash} hoặc {@code bank_transfer}), loại bỏ tài khoản đã xóa mềm, mới nhất trước.
     */
    @Transactional(readOnly = true)
    public List<UnpaidCourseEnrollmentDto> listUnpaidCourseEnrollments() {
        List<ClassEnrollmentRepository.UnpaidCourseEnrollmentRow> rows = enrollments.findUnpaidCourseEnrollments();
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        return rows.stream()
                .map(row -> new UnpaidCourseEnrollmentDto(
                        row.getEnrollmentId(),
                        row.getPaymentId(),
                        row.getClassId(),
                        row.getClassName(),
                        row.getDisciplineName(),
                        row.getStartDate(),
                        row.getEndDate(),
                        row.getMemberId(),
                        row.getMemberName(),
                        row.getMemberPhone(),
                        row.getMembershipCode(),
                        row.getAmount(),
                        row.getMethod(),
                        row.getCreatedAt()
                ))
                .toList();
    }

    /**
     * Quầy lễ tân hoặc quản lý xác nhận đã thu học phí khóa học (tiền mặt hoặc chuyển khoản): khóa lượt ghi
     * danh, kiểm tra trạng thái booked + khoản phí pending + không bị chặn bởi VNPay, cập nhật phương thức và
     * thu ngân, tất toán khoản thanh toán kèm xuất hóa đơn và gửi thông báo cho hội viên.
     */
    @Transactional
    public PaymentDto confirmCourseEnrollmentPayment(AuthenticatedPrincipal staff, Long enrollmentId, String method) {
        if (staff == null || staff.role() == null
                || (!ROLE_RECEPTIONIST.equalsIgnoreCase(staff.role())
                    && !ROLE_CENTER_MANAGER.equalsIgnoreCase(staff.role()))) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null,
                    "Only front desk or center manager can confirm course payment");
        }

        ClassEnrollment enrollment = enrollments.findByIdForUpdate(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", enrollmentId));
        if (!BOOKED.equalsIgnoreCase(enrollment.getStatus())) {
            throw new ConflictException(
                    "SCHEDULING_COURSE_PAYMENT_NOT_PENDING",
                    "error.scheduling.course_payment_not_pending",
                    null,
                    "This course enrollment has no pending tuition payment to collect");
        }
        if (paymentRepository == null) {
            throw new ConflictException(
                    "SCHEDULING_COURSE_PAYMENT_NOT_PENDING",
                    "error.scheduling.course_payment_not_pending",
                    null,
                    "This course enrollment has no pending tuition payment to collect");
        }

        Payment payment = paymentRepository.findByClassEnrollmentId(enrollmentId)
                .orElseThrow(() -> new ConflictException(
                        "SCHEDULING_COURSE_PAYMENT_NOT_PENDING",
                        "error.scheduling.course_payment_not_pending",
                        null,
                        "This course enrollment has no pending tuition payment to collect"));
        if (!"pending".equalsIgnoreCase(payment.getStatus())) {
            throw new ConflictException(
                    "SCHEDULING_COURSE_PAYMENT_NOT_PENDING",
                    "error.scheduling.course_payment_not_pending",
                    null,
                    "This course enrollment has no pending tuition payment to collect");
        }

        if (vnpayGuard != null) {
            vnpayGuard.enrollment(enrollmentId);
        }

        if (method != null && !method.isBlank()) {
            String normalized = method.trim().toLowerCase(Locale.ROOT);
            if (!COUNTER_PAYMENT_METHODS.contains(normalized)) {
                throw new BadRequestException(
                        "INVALID_PAYMENT_METHOD",
                        "error.scheduling.invalid_payment_method",
                        null,
                        "Unsupported counter payment method");
            }
            payment.setMethod(normalized);
        } else if (payment.getMethod() == null || !COUNTER_PAYMENT_METHODS.contains(payment.getMethod().toLowerCase(Locale.ROOT))) {
            payment.setMethod("cash");
        }

        if (userRepository != null && staff.id() != null) {
            userRepository.findByIdAndDeletedAtIsNull(staff.id()).ifPresent(payment::setReceivedBy);
        }
        paymentRepository.save(payment);
        paymentRepository.flush();

        PaymentDto dto;
        if (paymentService != null) {
            dto = paymentService.updatePaymentStatusByStaff(payment.getId(), "success");
        } else {
            payment.setStatus("success");
            payment.setPaidAt(LocalDateTime.now(clock));
            Payment settled = paymentRepository.save(payment);
            dto = toFallbackPaymentDto(settled != null ? settled : payment, enrollment.getGymClass());
        }

        if (notifications != null && enrollment.getMember() != null && enrollment.getMember().getUserId() != null) {
            GymClass gymClass = enrollment.getGymClass();
            String className = gymClass != null && gymClass.getName() != null ? gymClass.getName() : "";
            BigDecimal paidAmount = payment.getAmount() != null ? payment.getAmount() : BigDecimal.ZERO;
            notifications.send(
                    enrollment.getMember().getUserId(),
                    msg("notifications.scheduling.course_payment_confirmed.title"),
                    msg("notifications.scheduling.course_payment_confirmed.body",
                            className, paidAmount.stripTrailingZeros().toPlainString()),
                    "payment",
                    "payment",
                    payment.getId(),
                    "/member/classes"
            );
        }

        return dto;
    }

    /** Chuyển khoản thanh toán sang DTO tối thiểu khi chạy unit test không có PaymentService. */
    private static PaymentDto toFallbackPaymentDto(Payment payment, GymClass gymClass) {
        PaymentDto dto = new PaymentDto();
        dto.setId(payment.getId());
        if (payment.getMember() != null) {
            dto.setMemberId(payment.getMember().getUserId());
            if (payment.getMember().getUser() != null) {
                dto.setMemberName(payment.getMember().getUser().getFullName());
            }
        }
        dto.setClassEnrollmentId(payment.getClassEnrollmentId());
        dto.setAmount(payment.getAmount());
        dto.setMethod(payment.getMethod());
        dto.setStatus(payment.getStatus());
        dto.setPaidAt(payment.getPaidAt());
        if (payment.getReceivedBy() != null) {
            dto.setReceivedById(payment.getReceivedBy().getId());
            dto.setReceivedByName(payment.getReceivedBy().getFullName());
        }
        dto.setNote(payment.getNote());
        dto.setCreatedAt(payment.getCreatedAt());
        dto.setServiceType("CLASS");
        dto.setServiceName(gymClass != null ? gymClass.getName() : null);
        return dto;
    }

    /** Chọn buổi đại diện của lớp: buổi chưa hủy gần nhất từ hôm nay, nếu không có thì buổi đầu tiên. */
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

    /** True nếu role là nhân viên (quản lý, nhân viên, lễ tân). */
    private boolean isStaffRole(String role) {
        return ROLE_CENTER_MANAGER.equals(role)
                || ROLE_MANAGER.equals(role)
                || ROLE_STAFF.equals(role)
                || ROLE_RECEPTIONIST.equals(role);
    }

    /** Lấy buổi học theo id, không có thì báo không tìm thấy. */
    private ClassSession findSession(Long sessionId) {
        return sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
    }

    /** Lấy hội viên theo id, không có thì báo không tìm thấy. */
    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    /** Chuyển lượt ghi danh sang DTO kèm buổi đại diện và tiến độ khóa học. */
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

    /**
     * Mảng {tổng số buổi, số buổi đã dự, số buổi còn lại} trong khóa học của hội viên, hoặc các giá trị null
     * khi khóa học không có dữ liệu lịch/điểm danh.
     */
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
