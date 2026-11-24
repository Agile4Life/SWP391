package com.swp391.scms.finance.service;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.finance.dto.PaymentCreateDto;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.dto.PaymentProcessDto;
import com.swp391.scms.finance.dto.PaymentRefundRequest;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.mapper.PaymentMapper;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Dịch vụ quản lý các giao dịch thanh toán: tạo khoản thu, thu tiền một bước ở quầy, đổi trạng thái (kích hoạt gói khi thành công),
 * hoàn tiền (thu hồi quyền lợi khi hoàn toàn bộ) và mô tả khoản thu cho hội viên. Mọi thay đổi trên khoản thu
 * đang có lượt VNPay chờ đều bị chặn.
 */
@Service
@Transactional
public class PaymentService {
    private final com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    private static final java.util.regex.Pattern RECEIPT_DATA_URL =
            java.util.regex.Pattern.compile("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$");

    private static final Set<String> VALID_STATUSES = Set.of("success", "pending", "failed", "refunded");

    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final MembershipSubscriptionRepository membershipSubscriptionRepository;
    private final ClassEnrollmentRepository classEnrollmentRepository;
    private final PaymentMapper paymentMapper;
    private final Clock clock;

    @Autowired(required = false)
    private EntityManager entityManager;

    @Autowired(required = false)
    private com.swp391.scms.common.i18n.MessageService messageService;

    @Autowired(required = false)
    private com.swp391.scms.facilities.repository.MembershipPackageRepository membershipPackageRepository;

    @Autowired(required = false)
    private InvoiceService invoiceService;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.swp391.scms.scheduling.service.EnrollmentService enrollmentService;

    @Autowired(required = false)
    private com.swp391.scms.coaching.repository.CoachBookingRepository coachBookingRepository;

    @Autowired(required = false)
    private com.swp391.scms.membership.service.EntitlementRevocationService entitlementRevocation;

    @Autowired(required = false)
    private com.swp391.scms.finance.repository.VnpayTransactionRepository vnpayTransactionRepository;

    /** Gán giá trị mới cho trường vnpayTransactionRepository. */
    public void setVnpayTransactionRepository(com.swp391.scms.finance.repository.VnpayTransactionRepository vnpayTransactionRepository) {
        this.vnpayTransactionRepository = vnpayTransactionRepository;
    }

    /** Constructor cho test với các phụ thuộc tối thiểu. */
    public PaymentService(PaymentRepository paymentRepository,
                          MemberRepository memberRepository,
                          UserRepository userRepository,
                          PaymentMapper paymentMapper, Clock clock) {
        this(paymentRepository, memberRepository, userRepository, null, null, paymentMapper, clock);
    }

    /** Constructor cho test có thêm repository. */
    public PaymentService(PaymentRepository paymentRepository,
                          MemberRepository memberRepository,
                          UserRepository userRepository,
                          MembershipSubscriptionRepository membershipSubscriptionRepository,
                          ClassEnrollmentRepository classEnrollmentRepository,
                          PaymentMapper paymentMapper, Clock clock) {
        this(paymentRepository, memberRepository, userRepository, membershipSubscriptionRepository, classEnrollmentRepository, paymentMapper, clock, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public PaymentService(PaymentRepository paymentRepository,
                          MemberRepository memberRepository,
                          UserRepository userRepository,
                          MembershipSubscriptionRepository membershipSubscriptionRepository,
                          ClassEnrollmentRepository classEnrollmentRepository,
                          PaymentMapper paymentMapper, Clock clock, com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard) {
        this.vnpayGuard = vnpayGuard;
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.membershipSubscriptionRepository = membershipSubscriptionRepository;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.paymentMapper = paymentMapper;
        this.clock = clock;
    }

    /**
     * Tạo khoản thu theo vai trò: yêu cầu của hội viên chỉ ở trạng thái pending (thanh toán tiền mặt phải kèm
     * ảnh biên lai); nhân viên giữ nguyên quy trình thu ngân hiện có.
     */
    public PaymentDto createPayment(AuthenticatedPrincipal principal, PaymentCreateDto dto) {
        if (principal == null) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, null);
        }
        if ("MEMBER".equalsIgnoreCase(principal.role())) {
            if (!principal.id().equals(dto.getMemberId())) {
                throw new ForbiddenException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null, null);
            }
            if ((dto.getStatus() != null && !"pending".equalsIgnoreCase(dto.getStatus()))
                    || dto.getPaidAt() != null || dto.getReceivedById() != null) {
                throw new ForbiddenException("PAYMENT_MEMBER_PENDING_ONLY", "finance.payment.member_pending_only", null, null);
            }
            validateMemberPaymentTarget(principal.id(), dto);
            if ("cash".equalsIgnoreCase(dto.getMethod())
                    && (dto.getReceiptImage() == null || dto.getReceiptImage().isBlank())) {
                throw new BadRequestException("PAYMENT_RECEIPT_REQUIRED", "finance.payment.receipt_required", null, null);
            }
        } else if (!"CENTER_MANAGER".equalsIgnoreCase(principal.role())
                && !"RECEPTIONIST".equalsIgnoreCase(principal.role())) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, null);
        }
        return createPayment(dto);
    }

    /**
     * Kiểm tra đối tượng hội viên tự thanh toán: phải là kỳ gói chờ thanh toán của mình với đúng số tiền, hoặc
     * khóa học của mình còn trả được.
     */
    private void validateMemberPaymentTarget(Long memberId, PaymentCreateDto dto) {
        if (dto.getSubscriptionId() == null && dto.getClassEnrollmentId() == null) {
            throw new BadRequestException("PAYMENT_TARGET_REQUIRED", "finance.payment.target_required", null, null);
        }
        if (dto.getSubscriptionId() != null) {
            MembershipSubscription subscription = membershipSubscriptionRepository.findById(dto.getSubscriptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", dto.getSubscriptionId()));
            if (subscription.getMember() == null || !memberId.equals(subscription.getMember().getUserId())) {
                throw new ForbiddenException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null, null);
            }
            if (!"pending_payment".equals(subscription.getStatus())) {
                throw new BadRequestException("PAYMENT_SUBSCRIPTION_NOT_PENDING", "finance.payment.subscription_not_pending", null, null);
            }
            BigDecimal expectedPrice = subscription.payableAmount();
            if (dto.getAmount().compareTo(expectedPrice) != 0) {
                throw new BadRequestException("PAYMENT_AMOUNT_MISMATCH", "finance.payment.amount_mismatch",
                        new Object[]{dto.getAmount(), expectedPrice}, null);
            }
        }
        if (dto.getClassEnrollmentId() != null) {
            ClassEnrollment enrollment = classEnrollmentRepository.findById(dto.getClassEnrollmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", dto.getClassEnrollmentId()));
            if (enrollment.getMember() == null || !memberId.equals(enrollment.getMember().getUserId())) {
                throw new ForbiddenException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null, null);
            }
            requirePayableEnrollment(enrollment);
        }
    }

    /**
     * Tạo khoản thu: ảnh biên lai đúng định dạng; với kỳ gói thì khóa hội viên, kỳ phải đang chờ thanh toán,
     * chưa có khoản thu nào và số tiền đúng giá đã chốt; khoản cho kỳ gói luôn bắt đầu ở trạng thái pending.
     */
    public PaymentDto createPayment(PaymentCreateDto dto) {
        if (dto.getReceiptImage() != null && !RECEIPT_DATA_URL.matcher(dto.getReceiptImage()).matches()) {
            throw new BadRequestException("PAYMENT_RECEIPT_INVALID", "finance.payment.receipt_invalid", null, null);
        }
        Member member = memberRepository.findById(dto.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", dto.getMemberId()));

        if (dto.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
            MembershipSubscription target = membershipSubscriptionRepository.findById(dto.getSubscriptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", dto.getSubscriptionId()));
            if (target.getMember() == null || !member.getUserId().equals(target.getMember().getUserId())) {
                throw new BadRequestException("PAYMENT_MEMBER_MISMATCH",
                        "finance.payment.member_mismatch", null, null);
            }
            memberRepository.findByUserIdForUpdate(member.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", member.getUserId()));
            if (entityManager != null) entityManager.refresh(target);
            if (!"pending_payment".equals(target.getStatus())) {
                throw new BadRequestException("PAYMENT_SUBSCRIPTION_NOT_PENDING",
                        "finance.payment.subscription_not_pending", null, null);
            }
            if (!paymentRepository.findAllBySubscriptionId(target.getId()).isEmpty()) {
                throw new ConflictException("RENEWAL_PAYMENT_EXISTS",
                        "error.membership.renewal_payment_exists", null, "Payment already exists");
            }
            BigDecimal expectedPrice = target.payableAmount();
            if (expectedPrice == null || dto.getAmount().compareTo(expectedPrice) != 0) {
                throw new BadRequestException("PAYMENT_AMOUNT_MISMATCH", "finance.payment.amount_mismatch",
                        new Object[]{dto.getAmount(), expectedPrice}, "Payment amount mismatch");
            }
        }

        if (vnpayGuard != null && dto.getClassEnrollmentId() != null) {
            paymentRepository.findByClassEnrollmentId(dto.getClassEnrollmentId()).ifPresent(p -> vnpayGuard.payment(p.getId()));
        }
        User receiver = null;
        if (dto.getReceivedById() != null) {
            receiver = userRepository.findByIdAndDeletedAtIsNull(dto.getReceivedById())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.cashier", dto.getReceivedById()));
        }

        Payment payment = paymentMapper.toEntity(dto);
        payment.setMember(member);
        payment.setReceivedBy(receiver);

        if (dto.getMethod() != null) {
            payment.setMethod(dto.getMethod().toLowerCase(Locale.ROOT));
        }
        String initialStatus = dto.getStatus() != null ? dto.getStatus().toLowerCase(Locale.ROOT) : "pending";
        if (dto.getSubscriptionId() != null && !"pending".equals(initialStatus)) {
            throw new BadRequestException("PAYMENT_SUBSCRIPTION_NOT_PENDING",
                    "finance.payment.subscription_not_pending", null, "Confirm payment through the status flow");
        }
        payment.setStatus(initialStatus);
        markPaidIfSuccess(payment, initialStatus);

        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toDto(saved);
    }

    /** Chi tiết khoản thu kèm ảnh biên lai và cờ đang chờ VNPay. */
    @Transactional(readOnly = true)
    public PaymentDto getPaymentById(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", id));
        PaymentDto dto = paymentMapper.toDto(payment);
        if (dto != null) {
            dto.setReceiptImage(payment.getReceiptImage());
            populateVnpayPending(payment, dto);
        }
        return dto;
    }

    /** Các khoản thu của hội viên kèm mô tả dịch vụ và cờ đang chờ VNPay. */
    @Transactional(readOnly = true)
    public List<PaymentDto> getPaymentsByMemberId(Long memberId) {
        if (!memberRepository.existsById(memberId)) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        List<Payment> payments = paymentRepository.findByMemberUserId(memberId);
        List<PaymentDto> dtos = paymentMapper.toDtoList(payments);
        if (dtos == null) return List.of();
        for (int i = 0; i < dtos.size() && i < payments.size(); i++) {
            if (dtos.get(i) != null) {
                describe(payments.get(i), dtos.get(i));
                populateVnpayPending(payments.get(i), dtos.get(i));
            }
        }
        return dtos;
    }

    /** Đánh dấu khoản thu đang có lượt VNPay còn hiệu lực (chưa quá hạn cộng thời gian chờ IPN). */
    private void populateVnpayPending(Payment payment, PaymentDto dto) {
        if (payment == null || dto == null || payment.getId() == null || vnpayTransactionRepository == null) return;
        if (!"pending".equalsIgnoreCase(payment.getStatus())) {
            dto.setVnpayPending(false);
            return;
        }
        LocalDateTime now = vnpayGuard != null
                ? vnpayGuard.now()
                : LocalDateTime.ofInstant(clock.instant(), java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        var attempts = vnpayTransactionRepository.findAllByPaymentId(payment.getId());
        boolean hasLiveAttempt = attempts != null && attempts.stream()
                .anyMatch(t -> t != null && "pending".equals(t.getStatus())
                        && (t.getExpiresAt() == null
                            || !t.getExpiresAt().plus(VnpayPaymentGuard.SETTLEMENT_GRACE).isBefore(now)));
        dto.setVnpayPending(hasLiveAttempt);
    }

    /**
     * Mô tả mục đích của khoản thu để hội viên phân biệt được các khoản chờ và khoản đã thanh toán:
     * loại dịch vụ (gói, khóa học, PT, sân, đơn hàng, nạp ví, khác) và tên (gói, lớp, HLV/sân kèm ngày giờ, mã đơn).
     * Đọc trong transaction vì các bản ghi liên kết được tải lười (lazy).
     */
    static PaymentDto describe(Payment payment, PaymentDto dto) {
        java.time.format.DateTimeFormatter day = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
        java.time.format.DateTimeFormatter hour = java.time.format.DateTimeFormatter.ofPattern("HH:mm");
        if (payment.getSubscriptionId() != null) {
            dto.setServiceType("MEMBERSHIP");
            var sub = payment.getSubscription();
            dto.setServiceName(sub != null && sub.getMembershipPackage() != null ? sub.getMembershipPackage().getName() : null);
        } else if (payment.getClassEnrollmentId() != null) {
            dto.setServiceType("CLASS");
            var enrollment = payment.getClassEnrollment();
            dto.setServiceName(enrollment != null && enrollment.getGymClass() != null ? enrollment.getGymClass().getName() : null);
        } else if (payment.getCoachBookingId() != null) {
            dto.setServiceType("PT");
            var booking = payment.getCoachBooking();
            if (booking != null) {
                String coach = booking.getCoach() != null && booking.getCoach().getUser() != null
                        ? booking.getCoach().getUser().getFullName() : "";
                dto.setServiceName(join(coach, booking.getBookingDate() == null ? null : booking.getBookingDate().format(day),
                        booking.getStartTime() == null ? null : booking.getStartTime().format(hour)));
            }
        } else if (payment.getCourtBookingId() != null) {
            dto.setServiceType("COURT");
            var booking = payment.getCourtBooking();
            if (booking != null) {
                dto.setServiceName(join(booking.getRoom() == null ? null : booking.getRoom().getName(),
                        booking.getBookingDate() == null ? null : booking.getBookingDate().format(day),
                        booking.getStartTime() == null ? null : booking.getStartTime().format(hour)));
            }
        } else if (payment.getProductOrderId() != null) {
            dto.setServiceType("SHOP");
            dto.setServiceName(payment.getProductOrder() != null ? payment.getProductOrder().getCode() : null);
        } else if (payment.getNote() != null && payment.getNote().startsWith("WALLET_TOPUP")) {
            dto.setServiceType("WALLET_TOPUP");
        } else {
            dto.setServiceType("OTHER");
        }
        return dto;
    }

    /** Nối các phần không trống bằng " · ". */
    private static String join(String... parts) {
        String joined = java.util.Arrays.stream(parts).filter(p -> p != null && !p.isBlank())
                .collect(java.util.stream.Collectors.joining(" · "));
        return joined.isEmpty() ? null : joined;
    }

    /**
     * Đổi trạng thái do quầy/quản lý thực hiện. Các khoản thanh toán đặt sân, PT 1:1, cửa hàng và nạp ví có luồng
     * xác nhận riêng để đồng thời đánh dấu lịch đặt/đơn hàng đã thanh toán hoặc cộng ví; quyết toán tại đây sẽ ghi nhận
     * tiền nhưng bỏ sót trạng thái đối tượng. (Luồng quyết toán VNPay gọi trực tiếp {@link #updatePaymentStatus} và tự
     * xử lý các đối tượng đó.)
     */
    public PaymentDto updatePaymentStatusByStaff(Long id, String status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", id));
        if (payment.getCourtBookingId() != null || payment.getCoachBookingId() != null
                || payment.getProductOrderId() != null
                || (payment.getNote() != null && payment.getNote().startsWith("WALLET_TOPUP"))) {
            throw new BadRequestException("PAYMENT_STATUS_USE_TARGET_FLOW", "finance.payment.use_target_flow", null,
                    "Confirm this payment from its court booking, 1:1 session, order or wallet screen");
        }
        return updatePaymentStatus(id, status);
    }

    /**
     * Đổi trạng thái khoản thu (khóa hội viên, chặn khi có lượt VNPay chờ): chỉ pending → success/failed hoặc
     * failed → pending; hoàn tiền phải qua refundPayment. Thành công thì kích hoạt kỳ gói/khóa học và xuất hóa
     * đơn; thất bại thì hủy đăng ký khóa học hoặc kỳ gia hạn.
     */
    public PaymentDto updatePaymentStatus(Long id, String status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", id));

        lockSubscriptionMember(payment);
        if (vnpayGuard != null) vnpayGuard.payment(payment.getId());
        if (status == null || !VALID_STATUSES.contains(status.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("INVALID_PAYMENT_STATUS", "finance.payment.invalid_status", new Object[]{status}, null);
        }
        String normalizedStatus = status.toLowerCase(Locale.ROOT);
        String currentStatus = payment.getStatus() != null ? payment.getStatus().toLowerCase(Locale.ROOT) : "pending";

        if (payment.getSubscriptionId() != null && "failed".equals(currentStatus) && "pending".equals(normalizedStatus)
                && membershipSubscriptionRepository != null) {
            MembershipSubscription target = membershipSubscriptionRepository.findById(payment.getSubscriptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", payment.getSubscriptionId()));
            if (!"pending_payment".equalsIgnoreCase(target.getStatus())) {
                throw new ConflictException("PAYMENT_SUBSCRIPTION_NOT_PENDING", "finance.payment.subscription_not_pending", null, null);
            }
        }

        if (!currentStatus.equals(normalizedStatus)) {
            boolean allowed = switch (currentStatus) {
                case "pending" -> "success".equals(normalizedStatus) || "failed".equals(normalizedStatus);
                case "failed" -> "pending".equals(normalizedStatus);
                // Hoàn tiền đi qua refundPayment (chỉ dành cho quản lý, có kiểm toán và ghi nhận lý do).
                default -> false;
            };
            if (!allowed) {
                throw new BadRequestException("INVALID_STATUS_TRANSITION", "finance.payment.invalid_transition",
                        new Object[]{currentStatus, normalizedStatus}, null);
            }
            if ("pending".equals(currentStatus) && "success".equals(normalizedStatus)
                    && payment.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
                MembershipSubscription target = membershipSubscriptionRepository.findById(payment.getSubscriptionId())
                        .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", payment.getSubscriptionId()));
                if (!"pending_payment".equals(target.getStatus())) {
                    throw new ConflictException("PAYMENT_SUBSCRIPTION_NOT_PENDING",
                            "finance.payment.subscription_not_pending", null, null);
                }
            }
            payment.setStatus(normalizedStatus);
            markPaidIfSuccess(payment, normalizedStatus);
            if ("pending".equals(currentStatus) && "failed".equals(normalizedStatus)) {
                cancelFailedRenewal(payment);
                cancelEnrollmentOfFailedPayment(payment);
            }
            if ("pending".equals(currentStatus) && "success".equals(normalizedStatus)) {
                activateLinkedTargetsOnSuccess(payment);
            }
        }

        PaymentDto dto = paymentMapper.toDto(payment);
        if ("pending".equals(currentStatus) && "success".equals(normalizedStatus)) {
            attachAutoIssuedInvoiceNumber(payment, dto);
        }
        return dto;
    }

    /**
     * Thu tiền một bước tại quầy: theo kỳ gói chờ thanh toán có sẵn, theo gói (dùng lại kỳ chờ hoặc tạo kỳ mới
     * nếu hội viên chưa có kỳ đã trả/đang bảo lưu/gia hạn trả trước), hoặc theo khóa học. Kiểm tra số tiền, ghi
     * khoản thu thành công, kích hoạt quyền lợi và xuất hóa đơn.
     */
    public PaymentDto processPayment(PaymentProcessDto dto) {
        if (dto.getSubscriptionId() == null && dto.getPackageId() == null && dto.getClassEnrollmentId() == null) {
            throw new BadRequestException("PAYMENT_TARGET_REQUIRED", "finance.payment.target_required", null,
                    "Target subscription or enrollment is required");
        }

        Member member = memberRepository.findByUserIdForUpdate(dto.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", dto.getMemberId()));

        if (dto.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
            MembershipSubscription target = membershipSubscriptionRepository.findById(dto.getSubscriptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", dto.getSubscriptionId()));
            if (entityManager != null) entityManager.refresh(target);
            if (target.getMember() == null || !member.getUserId().equals(target.getMember().getUserId())) {
                throw new BadRequestException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null, null);
            }
            if (dto.getPackageId() != null && (target.getMembershipPackage() == null
                    || !dto.getPackageId().equals(target.getMembershipPackage().getId()))) {
                throw new BadRequestException("PAYMENT_PACKAGE_MISMATCH", "error.membership.pos_package_mismatch",
                        null, "Checkout package does not match the subscription");
            }
        }

        if (vnpayGuard != null && dto.getClassEnrollmentId() != null) {
            paymentRepository.findByClassEnrollmentId(dto.getClassEnrollmentId()).ifPresent(p -> vnpayGuard.payment(p.getId()));
        }
        User receiver = null;
        if (dto.getReceivedById() != null) {
            receiver = userRepository.findByIdAndDeletedAtIsNull(dto.getReceivedById())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.cashier", dto.getReceivedById()));
        }

        Long resolvedSubscriptionId = dto.getSubscriptionId();
        Payment pendingToSettle = null;

        if (resolvedSubscriptionId == null && dto.getPackageId() != null
                && membershipPackageRepository != null && membershipSubscriptionRepository != null) {
            com.swp391.scms.facilities.entity.MembershipPackage pkg = membershipPackageRepository.findById(dto.getPackageId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.package", dto.getPackageId()));
            if (pkg.getStatus() != null && !"active".equalsIgnoreCase(pkg.getStatus())) {
                throw new BadRequestException("MEMBERSHIP_PACKAGE_INACTIVE", "membership.package.inactive",
                        new Object[]{pkg.getId()}, "Membership package is inactive");
            }
            List<MembershipSubscription> history = membershipSubscriptionRepository.findByMemberUserId(member.getUserId());
            if (history == null) history = List.of();
            if (history.stream().anyMatch(sub -> "frozen".equalsIgnoreCase(sub.getStatus()))) {
                throw new ConflictException("MEMBERSHIP_FROZEN_PAYMENT",
                        "error.membership.frozen_payment", null, "Membership on hold cannot be activated by payment");
            }
            if (history.stream().anyMatch(sub -> sub.getPreviousSubscription() != null
                    && "pending_payment".equals(sub.getStatus()))) {
                throw new ConflictException("RENEWAL_REQUIRES_SUBSCRIPTION_ID",
                        "error.membership.pos_renewal_requires_subscription", null,
                        "Use the checked subscription renewal for checkout");
            }
            java.time.LocalDate today = java.time.LocalDate.now(clock);
            if (history.stream().anyMatch(sub -> ("active".equals(sub.getStatus()) || "expired".equals(sub.getStatus()))
                    && (sub.getEndDate() == null || !sub.getEndDate().isBefore(today)))) {
                throw new ConflictException("MEMBERSHIP_ALREADY_ACTIVE",
                        "error.membership.already_active", null, "Member already has a paid period");
            }
            List<MembershipSubscription> pendingSubs = history.stream()
                    .filter(sub -> "pending_payment".equals(sub.getStatus())).toList();
            if (pendingSubs.size() > 1) {
                throw new ConflictException("MEMBERSHIP_PENDING_EXISTS",
                        "error.membership.pending_exists", null, "Multiple pending subscriptions need review");
            }
            if (!pendingSubs.isEmpty()) {
                MembershipSubscription pendingSub = pendingSubs.get(0);
                if (vnpayGuard != null) vnpayGuard.subscription(pendingSub.getId());
                if (pendingSub.getMembershipPackage() == null
                        || !pkg.getId().equals(pendingSub.getMembershipPackage().getId())) {
                    throw new BadRequestException("PAYMENT_PACKAGE_MISMATCH",
                            "error.membership.pos_package_mismatch", null, "Checkout package does not match the subscription");
                }
                pendingToSettle = payableExistingPayment(member.getUserId(), pendingSub.getId(), dto.getAmount(), dto.getClassEnrollmentId());
                validateCheckoutAmount(dto.getAmount(), pendingSub.payableAmount(), pendingToSettle);
                pendingSub.setCreatedBy(receiver);
                activateSubscription(pendingSub);
                resolvedSubscriptionId = pendingSub.getId();
            } else {
                validateCheckoutAmount(dto.getAmount(), pkg.getPrice(), null);
                MembershipSubscription sub = new MembershipSubscription();
                sub.setMember(member);
                sub.setMembershipPackage(pkg);
                sub.setStartDate(today);
                sub.setEndDate(today.plusDays(Math.max(1, pkg.getDurationDays()) - 1L));
                sub.setStatus("active");
                sub.setCreatedBy(receiver);
                sub.setCreatedAt(LocalDateTime.now(clock));
                sub.setUpdatedAt(LocalDateTime.now(clock));
                MembershipSubscription savedSub = membershipSubscriptionRepository.save(sub);
                Long subId = savedSub != null && savedSub.getId() != null ? savedSub.getId() : sub.getId();
                sub.setQrCode(UUID.randomUUID().toString());
                membershipSubscriptionRepository.save(sub);
                resolvedSubscriptionId = subId;
            }
        } else if (resolvedSubscriptionId != null && membershipSubscriptionRepository != null) {
            if (vnpayGuard != null) vnpayGuard.subscription(resolvedSubscriptionId);
            final Long targetSubId = resolvedSubscriptionId;
            MembershipSubscription subscription = membershipSubscriptionRepository.findById(targetSubId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", targetSubId));

            if (!subscription.getMember().getUserId().equals(member.getUserId())) {
                throw new BadRequestException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null,
                        "Subscription does not belong to member");
            }

            if (subscription.getStatus() != null && !"pending_payment".equalsIgnoreCase(subscription.getStatus())) {
                throw new ConflictException("PAYMENT_SUBSCRIPTION_NOT_PENDING", "finance.payment.subscription_not_pending",
                        null, "Subscription is not in pending_payment state");
            }

            if (subscription.getMembershipPackage() != null) {
                if (subscription.getMembershipPackage().getStatus() != null
                        && !"active".equalsIgnoreCase(subscription.getMembershipPackage().getStatus())) {
                    throw new BadRequestException("MEMBERSHIP_PACKAGE_INACTIVE", "membership.package.inactive",
                            new Object[]{subscription.getMembershipPackage().getId()}, "Membership package is inactive");
                }
            }

            pendingToSettle = payableExistingPayment(member.getUserId(), subscription.getId(), dto.getAmount(), dto.getClassEnrollmentId());
            if (subscription.getMembershipPackage() != null) {
                validateCheckoutAmount(dto.getAmount(), subscription.payableAmount(), pendingToSettle);
            }
            activateSubscription(subscription);
        }

        if (dto.getClassEnrollmentId() != null && classEnrollmentRepository != null) {
            ClassEnrollment enrollment = classEnrollmentRepository.findById(dto.getClassEnrollmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", dto.getClassEnrollmentId()));

            if (!enrollment.getMember().getUserId().equals(member.getUserId())) {
                throw new BadRequestException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null,
                        "Enrollment does not belong to member");
            }

            requirePayableEnrollment(enrollment);
        }

        if (pendingToSettle != null) {
            pendingToSettle.setStatus("success");
            pendingToSettle.setPaidAt(LocalDateTime.now(clock));
            pendingToSettle.setReceivedBy(receiver);
            pendingToSettle.setMethod(dto.getMethod() != null ? dto.getMethod().toLowerCase(Locale.ROOT) : "cash");
            pendingToSettle.setNote(dto.getNote());
            Payment savedPending = paymentRepository.save(pendingToSettle);
            Payment targetPayment = savedPending != null ? savedPending : pendingToSettle;
            PaymentDto resultDto = paymentMapper.toDto(targetPayment);
            attachAutoIssuedInvoiceNumber(targetPayment, resultDto);
            return resultDto;
        }

        Payment payment = new Payment();
        payment.setMember(member);
        payment.setSubscriptionId(resolvedSubscriptionId);
        payment.setClassEnrollmentId(dto.getClassEnrollmentId());
        payment.setAmount(dto.getAmount());
        payment.setMethod(dto.getMethod() != null ? dto.getMethod().toLowerCase(Locale.ROOT) : "cash");
        payment.setStatus("success");
        payment.setPaidAt(LocalDateTime.now(clock));
        payment.setReceivedBy(receiver);
        payment.setNote(dto.getNote());

        Payment saved = paymentRepository.save(payment);
        Payment targetPayment = saved != null ? saved : payment;
        PaymentDto resultDto = paymentMapper.toDto(targetPayment);
        attachAutoIssuedInvoiceNumber(targetPayment, resultDto);
        return resultDto;
    }

    /**
     * Hoàn tiền (quản lý): khóa dòng khoản thu, chỉ khoản thành công, số tiền trong phần còn lại. Hoàn toàn bộ
     * thì hủy kỳ gói/khóa học liên quan, khôi phục kỳ cũ bị thay khi nâng cấp và hủy lịch không còn quyền lợi;
     * khoản sân/PT/đơn hàng phải hoàn bằng cách hủy lịch/đơn. Hoàn một phần thì gói vẫn tiếp tục.
     */
    @Audited(action = "PAYMENT_REFUND", entity = "payments")
    public PaymentDto refundPayment(Long paymentId, PaymentRefundRequest request) {
        if (vnpayGuard != null) vnpayGuard.refund(paymentId);
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", paymentId));
        // Hai yêu cầu hoàn tiền đồng thời không được cùng đọc một giá trị refundedAmount.
        if (entityManager != null) entityManager.refresh(payment, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);

        String currentStatus = payment.getStatus() != null ? payment.getStatus().toLowerCase(Locale.ROOT) : "";
        if (!"success".equals(currentStatus)) {
            throw new BadRequestException("CANNOT_REFUND_PAYMENT", "finance.payment.cannot_refund",
                    new Object[]{currentStatus}, "Only successful payments can be refunded");
        }

        BigDecimal alreadyRefunded = payment.getRefundedAmount() != null ? payment.getRefundedAmount() : BigDecimal.ZERO;
        BigDecimal refundable = payment.getAmount().subtract(alreadyRefunded);
        BigDecimal refundAmount = request.getRefundAmount() != null ? request.getRefundAmount() : refundable;
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0 || refundAmount.compareTo(refundable) > 0) {
            throw new BadRequestException("INVALID_REFUND_AMOUNT", "finance.payment.invalid_refund_amount",
                    new Object[]{refundAmount, refundable}, "Invalid refund amount");
        }

        BigDecimal totalRefunded = alreadyRefunded.add(refundAmount);
        boolean fullRefund = totalRefunded.compareTo(payment.getAmount()) == 0;
        // Các khoản thanh toán đặt sân, PT 1:1 và cửa hàng được hoàn toàn bộ bằng cách hủy lịch đặt/đơn hàng để
        // đồng thời giải phóng khung giờ hoặc tồn kho; hoàn tại đây sẽ để lịch đặt còn sống và cho phép hủy sau đó hoàn tiền lần nữa.
        if (fullRefund && (payment.getCourtBookingId() != null || payment.getCoachBookingId() != null
                || payment.getProductOrderId() != null)) {
            throw new BadRequestException("REFUND_VIA_CANCELLATION", "finance.payment.refund_via_cancellation", null,
                    "Cancel the booking or order to refund it in full");
        }
        payment.setRefundedAmount(totalRefunded);
        // Hoàn tiền một phần vẫn giữ khoản thanh toán thành công và gói hội viên tiếp tục chạy; chỉ hoàn toàn bộ mới kết thúc nó.
        if (fullRefund) {
            payment.setStatus("refunded");
        }
        String refundNote = resolveRefundNote(refundAmount, request.getReason());
        String combinedNote = (payment.getNote() != null && !payment.getNote().isBlank())
                ? payment.getNote() + " | " + refundNote
                : refundNote;
        if (combinedNote.length() > 255) {
            combinedNote = combinedNote.substring(0, 255);
        }
        payment.setNote(combinedNote);

        if (fullRefund) {
            cancelLinkedTargetsOnRefund(payment, request.getReason());
        }

        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toDto(saved);
    }

    /** Khi hoàn toàn bộ: hủy kỳ gói và đăng ký khóa học gắn với khoản thu. */
    private void cancelLinkedTargetsOnRefund(Payment payment, String cancelReason) {
        if (payment.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
            membershipSubscriptionRepository.findById(payment.getSubscriptionId()).ifPresent(sub -> {
                sub.setStatus("cancelled");
                sub.setHoldStatus(null);
                sub.setUpdatedAt(LocalDateTime.now(clock));
                membershipSubscriptionRepository.save(sub);
                restorePeriodReplacedByUpgrade(sub);
                cancelFutureBookingsWithoutEntitlement(sub, cancelReason);
            });
        }

        if (payment.getClassEnrollmentId() != null && classEnrollmentRepository != null) {
            classEnrollmentRepository.findById(payment.getClassEnrollmentId()).ifPresent(enrollment -> {
                enrollment.setStatus("cancelled");
                if (cancelReason != null) {
                    enrollment.setCancelReason(cancelReason);
                }
                enrollment.setCancelledAt(LocalDateTime.now(clock));
                classEnrollmentRepository.save(enrollment);
            });
        }
    }

    /**
     * Hoàn tiền một kỳ nâng cấp sẽ trả lại kỳ nó đã thay thế: gói cũ quay lại trạng thái active với ngày hết hạn
     * vốn có trước khi việc nâng cấp cắt ngắn về ngày nâng cấp, trừ khi ngày đó đã qua.
     */
    private void restorePeriodReplacedByUpgrade(MembershipSubscription refunded) {
        MembershipSubscription previous = refunded.getPreviousSubscription();
        if (previous == null || !isUpgradeOf(refunded, previous) || !"expired".equalsIgnoreCase(previous.getStatus())) {
            return;
        }
        java.time.LocalDate originalEnd = refunded.getReplacedEndDate();
        if (originalEnd == null && previous.getStartDate() != null && previous.getMembershipPackage() != null
                && previous.getEndDate() != null && previous.getEndDate().equals(refunded.getStartDate())) {
            // Các kỳ nâng cấp kích hoạt trước khi có trường replacedEndDate: tính lại thời hạn từ độ dài của gói.
            originalEnd = previous.getStartDate().plusDays(Math.max(1, previous.getMembershipPackage().getDurationDays()) - 1L);
        }
        java.time.LocalDate today = java.time.LocalDate.now(clock);
        if (originalEnd == null || originalEnd.isBefore(today)) {
            return;
        }
        previous.setStatus("active");
        previous.setEndDate(originalEnd);
        previous.setUpdatedAt(LocalDateTime.now(clock));
        membershipSubscriptionRepository.save(previous);
    }

    /** Kỳ này có phải là nâng cấp từ kỳ trước không (khác gói hoặc có phí nâng cấp). */
    private static boolean isUpgradeOf(MembershipSubscription subscription, MembershipSubscription previous) {
        return subscription.getMembershipPackage() != null && previous.getMembershipPackage() != null
                && previous.getMembershipPackage().getId() != null
                && (!previous.getMembershipPackage().getId().equals(subscription.getMembershipPackage().getId())
                    || subscription.getUpgradeCharge() != null);
    }

    /**
     * Gói hội viên đã hoàn tiền không còn cấp quyền đặt lịch, trừ khi vẫn còn một kỳ đã thanh toán khác bao phủ hội viên.
     */
    private void cancelFutureBookingsWithoutEntitlement(MembershipSubscription refunded, String reason) {
        if (refunded.getMember() == null) return;
        Long memberId = refunded.getMember().getUserId();
        if (entitlementRevocation != null) {
            // Kiểm tra từng ngày đặt lịch, nên khoảng trống trước kỳ gia hạn về sau cũng được giải phóng.
            entitlementRevocation.revokeUncoveredBookings(memberId, reason != null && !reason.isBlank() ? reason : "Refunded membership");
            return;
        }
        java.time.LocalDate today = java.time.LocalDate.now(clock);
        boolean stillCovered = membershipSubscriptionRepository.findByMemberUserId(memberId).stream()
                .anyMatch(other -> !other.getId().equals(refunded.getId())
                        && ("active".equalsIgnoreCase(other.getStatus()) || "frozen".equalsIgnoreCase(other.getStatus()))
                        && other.getEndDate() != null && !other.getEndDate().isBefore(today));
        if (stillCovered) return;
        String cancelReason = reason != null && !reason.isBlank() ? reason : "Refunded membership";
        if (cancelReason.length() > 255) cancelReason = cancelReason.substring(0, 255);
        if (enrollmentService != null) {
            enrollmentService.cancelFutureEnrollmentsForMember(memberId, cancelReason);
        }
        if (coachBookingRepository != null) {
            for (var booking : coachBookingRepository.findFutureConfirmedByMember(memberId, today)) {
                booking.setStatus("cancelled");
                booking.setCancelledAt(LocalDateTime.now(clock));
                booking.setCancelReason(cancelReason);
            }
        }
    }

    /** Gắn số hóa đơn tự xuất vào DTO trả về (lỗi xuất hóa đơn bỏ qua). */
    private void attachAutoIssuedInvoiceNumber(Payment payment, PaymentDto dto) {
        if (invoiceService == null || payment == null || payment.getId() == null || dto == null) {
            return;
        }
        if (dto.getInvoiceNumber() != null && !dto.getInvoiceNumber().isBlank()) {
            return;
        }
        try {
            com.swp391.scms.finance.dto.InvoiceDto issued = invoiceService.autoIssueInvoiceForPayment(payment.getId());
            if (issued != null && issued.getInvoiceNumber() != null) {
                dto.setInvoiceNumber(issued.getInvoiceNumber());
            }
        } catch (Exception ignored) {
            // Tự xuất hóa đơn theo cơ chế best-effort trong luồng thanh toán 1 bước.
        }
    }

    /** Khóa dòng hội viên của kỳ gói gắn với khoản thu để các thao tác thanh toán song song xếp hàng. */
    private void lockSubscriptionMember(Payment payment) {
        if (payment.getSubscriptionId() == null || membershipSubscriptionRepository == null) return;
        MembershipSubscription target = membershipSubscriptionRepository.findById(payment.getSubscriptionId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", payment.getSubscriptionId()));
        memberRepository.findByUserIdForUpdate(target.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", target.getMember().getUserId()));
        if (entityManager != null) {
            entityManager.refresh(payment);
            entityManager.refresh(target);
        }
    }
    /**
     * Học phí khóa học thanh toán thất bại chưa từng giữ chỗ: giải phóng đăng ký để lớp học và hạn mức của hội viên được trả lại.
     */
    private void cancelEnrollmentOfFailedPayment(Payment payment) {
        if (payment.getClassEnrollmentId() == null || classEnrollmentRepository == null) return;
        classEnrollmentRepository.findById(payment.getClassEnrollmentId()).ifPresent(enrollment -> {
            if ("booked".equalsIgnoreCase(enrollment.getStatus())) {
                enrollment.setStatus("cancelled");
                enrollment.setCancelledAt(LocalDateTime.now(clock));
                enrollment.setCancelReason("Course payment failed");
                classEnrollmentRepository.save(enrollment);
            }
        });
    }
    /** Kỳ gia hạn thanh toán thất bại chưa từng có hiệu lực: hủy để hội viên tạo yêu cầu mới. */
    private void cancelFailedRenewal(Payment payment) {
        if (payment.getSubscriptionId() == null || membershipSubscriptionRepository == null) return;
        membershipSubscriptionRepository.findById(payment.getSubscriptionId()).ifPresent(subscription -> {
            if (subscription.getPreviousSubscription() != null
                    && "pending_payment".equals(subscription.getStatus())) {
                // Kỳ gia hạn thất bại chưa từng cấp quyền lợi; cho phép tạo yêu cầu mới trên kỳ cha đã thanh toán.
                subscription.setStatus("cancelled");
                subscription.setUpdatedAt(LocalDateTime.now(clock));
                membershipSubscriptionRepository.save(subscription);
            }
        });
    }

    /** Khi thanh toán thành công: kích hoạt kỳ gói và xác nhận khóa học gắn với khoản thu. */
    private void activateLinkedTargetsOnSuccess(Payment payment) {
        if (payment.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
            membershipSubscriptionRepository.findById(payment.getSubscriptionId()).ifPresent(this::activateSubscription);
        }
        if (payment.getClassEnrollmentId() != null && classEnrollmentRepository != null) {
            classEnrollmentRepository.findById(payment.getClassEnrollmentId())
                    .ifPresent(this::requirePayableEnrollment);
        }
    }

    /**
     * Việc thanh toán không làm thay đổi trạng thái đăng ký khóa học; đăng ký ở trạng thái booked hoặc attended có thể
     * thanh toán, còn đăng ký đã cancelled thì không.
     */
    private void requirePayableEnrollment(ClassEnrollment enrollment) {
        if ("cancelled".equalsIgnoreCase(enrollment.getStatus())) {
            throw new ConflictException("PAYMENT_ENROLLMENT_NOT_PAYABLE", "finance.payment.enrollment_not_payable",
                    new Object[]{enrollment.getStatus()}, null);
        }
    }

    /**
     * Kích hoạt kỳ gói đã trả: chặn khi có kỳ khác đang hiệu lực trùng; với nâng cấp thì kỳ mới bắt đầu từ ngày
     * báo giá (đã tính phần quy đổi) và kỳ cũ bị cắt về ngày đó; kỳ gia hạn trả muộn vẫn giữ đủ số ngày; tạo mã
     * QR nếu chưa có.
     */
    private void activateSubscription(MembershipSubscription subscription) {
        if (!"pending_payment".equalsIgnoreCase(subscription.getStatus())) {
            throw new ConflictException("PAYMENT_SUBSCRIPTION_NOT_PENDING", "finance.payment.subscription_not_pending", null, null);
        }
        java.time.LocalDate today = java.time.LocalDate.now(clock);
        if (membershipSubscriptionRepository.findByMemberUserId(
                subscription.getMember().getUserId()).stream()
                .anyMatch(item -> "frozen".equalsIgnoreCase(item.getStatus()))) {
            throw new ConflictException("MEMBERSHIP_FROZEN_PAYMENT",
                    "error.membership.frozen_payment", null,
                    "Membership on hold cannot be activated by payment");
        }
        MembershipSubscription previous = subscription.getPreviousSubscription();
        if (previous != null && ("cancelled".equalsIgnoreCase(previous.getStatus())
                || "frozen".equalsIgnoreCase(previous.getStatus()))) {
            throw new ConflictException("PAYMENT_PREVIOUS_UNAVAILABLE", "finance.payment.previous_unavailable", null, null);
        }
        boolean isUpgrade = previous != null
                && subscription.getMembershipPackage() != null
                && previous.getMembershipPackage() != null
                && previous.getMembershipPackage().getId() != null
                && (!previous.getMembershipPackage().getId().equals(subscription.getMembershipPackage().getId())
                    || subscription.getUpgradeCharge() != null);

        if (isUpgrade && membershipSubscriptionRepository.findByMemberUserId(
                subscription.getMember().getUserId()).stream()
                .anyMatch(item -> item.getPreviousSubscription() != null
                        && ("active".equalsIgnoreCase(item.getStatus())
                            || "expired".equalsIgnoreCase(item.getStatus()))
                        && item.getStartDate() != null && item.getStartDate().isAfter(today))) {
            throw new ConflictException("MEMBERSHIP_FUTURE_PAID_RENEWAL",
                    "error.membership.future_paid_renewal", null,
                    "Paid future renewal requires manager review");
        }
        // Báo giá quy đổi (prorated) đã khấu trừ phần giá trị kỳ cũ tính đến ngày báo giá, nên kỳ mới cũng chạy từ ngày đó
        // để các ngày sử dụng giữa lúc báo giá và lúc thanh toán không bị khấu trừ hai lần. Báo giá kiểu cũ (không có credit) bắt đầu từ ngày thanh toán.
        java.time.LocalDate upgradeStart = isUpgrade ? proratedUpgradeStart(subscription, previous, today) : today;
        if (isUpgrade && "active".equalsIgnoreCase(previous.getStatus())) {
            previous.setStatus("expired");
            previous.setHoldStatus(null);
            if (previous.getEndDate() != null && previous.getEndDate().isAfter(upgradeStart)) {
                subscription.setReplacedEndDate(previous.getEndDate());
                previous.setEndDate(upgradeStart);
            }
            previous.setUpdatedAt(LocalDateTime.now(clock));
            membershipSubscriptionRepository.save(previous);
        }

        if ((subscription.getPreviousSubscription() == null || isUpgrade)
                && subscription.getMembershipPackage() != null
                && subscription.getMembershipPackage().getDurationDays() > 0
                && (isUpgrade || subscription.getStartDate() == null || subscription.getStartDate().isBefore(today))) {
            int durationDays = Math.max(1, subscription.getMembershipPackage().getDurationDays());
            java.time.LocalDate start = isUpgrade ? upgradeStart : today;
            subscription.setStartDate(start);
            subscription.setEndDate(start.plusDays(durationDays - 1L));
        } else if (subscription.getPreviousSubscription() != null && !isUpgrade
                && subscription.getStartDate() != null && subscription.getEndDate() != null
                && subscription.getStartDate().isBefore(today)) {
            // Kỳ gia hạn thanh toán sau ngày bắt đầu dự kiến vẫn giữ đủ thời lượng thay vì bị mất những ngày chưa thanh toán.
            long lengthDays = java.time.temporal.ChronoUnit.DAYS.between(subscription.getStartDate(), subscription.getEndDate());
            subscription.setStartDate(today);
            subscription.setEndDate(today.plusDays(lengthDays));
        }
        subscription.setStatus("active");
        if (subscription.getQrCode() == null || subscription.getQrCode().isBlank()) {
            subscription.setQrCode(UUID.randomUUID().toString());
        }
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        membershipSubscriptionRepository.save(subscription);
    }

    /**
     * Ngày bắt đầu của kỳ nâng cấp đã thanh toán: là ngày báo giá khi phí được tính quy đổi, không bao giờ trước ngày
     * bắt đầu kỳ bị thay thế và không sau hôm nay; trường hợp khác (báo giá tạo trước khi có quy đổi) là ngày thanh toán.
     */
    private static java.time.LocalDate proratedUpgradeStart(MembershipSubscription upgrade, MembershipSubscription previous,
                                                            java.time.LocalDate today) {
        java.time.LocalDate quotedOn = upgrade.getStartDate();
        if (upgrade.getCreditApplied() == null || quotedOn == null || quotedOn.isAfter(today)) return today;
        if (previous.getStartDate() != null && quotedOn.isBefore(previous.getStartDate())) return previous.getStartDate();
        return quotedOn;
    }

    /** Số tiền thu phải đúng: khoản đang chờ có sẵn giữ nguyên số tiền ban đầu dù giá danh mục đã đổi. */
    private void validateCheckoutAmount(BigDecimal amount, BigDecimal payable, Payment existing) {
        // Khoản thanh toán pending đã lưu giữ nguyên số tiền gốc ngay cả khi giá danh mục thay đổi sau đó.
        BigDecimal expected = existing != null ? existing.getAmount() : payable;
        if (expected != null && amount.compareTo(expected) != 0) {
            throw new BadRequestException("PAYMENT_AMOUNT_MISMATCH", "finance.payment.amount_mismatch",
                    new Object[]{amount, expected}, null);
        }
    }

    /**
     * Khoản thu đang chờ có thể dùng lại cho kỳ gói/khóa học (chỉ khi có đúng một khoản chưa xong ở trạng thái
     * pending).
     */
    private Payment payableExistingPayment(Long memberId, Long subscriptionId, BigDecimal amount, Long enrollmentId) {
        List<Payment> related = paymentRepository.findAllBySubscriptionId(subscriptionId);
        if (related == null || related.isEmpty()) return null;
        List<Payment> unsettled = related.stream().filter(payment ->
                "pending".equalsIgnoreCase(payment.getStatus()) || "success".equalsIgnoreCase(payment.getStatus())).toList();
        if (unsettled.isEmpty()) return null;
        if (unsettled.size() != 1 || !"pending".equalsIgnoreCase(unsettled.get(0).getStatus())
                || unsettled.get(0).getMember() == null
                || !memberId.equals(unsettled.get(0).getMember().getUserId())
                || unsettled.get(0).getAmount().compareTo(amount) != 0) {
            throw new ConflictException("PAYMENT_ALREADY_EXISTS", "finance.payment.already_exists", null, null);
        }
        if (enrollmentId != null) {
            throw new BadRequestException("PAYMENT_TARGET_REQUIRED", "finance.payment.target_required", null, null);
        }
        return unsettled.get(0);
    }

    /** Ghi chú hoàn tiền đã dịch kèm số tiền và lý do. */
    private String resolveRefundNote(BigDecimal refundAmount, String reason) {
        String fallback = "[HOÀN TIỀN: " + refundAmount + " VNĐ] Lý do: " + reason;
        if (messageService == null) {
            return fallback;
        }
        String resolved = messageService.getMessage("finance.payment.refund_note", new Object[]{refundAmount, reason});
        return (resolved == null || resolved.isBlank() || "finance.payment.refund_note".equals(resolved))
                ? fallback
                : resolved;
    }

    /** Gán thời điểm trả khi trạng thái là success và chưa có. */
    private void markPaidIfSuccess(Payment payment, String status) {
        if ("success".equals(status) && payment.getPaidAt() == null) {
            payment.setPaidAt(LocalDateTime.now(clock));
        }
    }
}
