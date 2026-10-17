package com.swp391.scms.finance.service;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.BadRequestException;
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
import com.swp391.scms.membership.service.MembershipService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.List;
import java.util.Set;

/**
 * Service managing Payments transactions.
 */
@Service
@Transactional
public class PaymentService {

    private static final Set<String> VALID_STATUSES = Set.of("success", "pending", "failed", "refunded");

    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final MembershipSubscriptionRepository membershipSubscriptionRepository;
    private final MembershipService membershipService;
    private final ClassEnrollmentRepository classEnrollmentRepository;
    private final PaymentMapper paymentMapper;
    private final Clock clock;

    public PaymentService(PaymentRepository paymentRepository,
                          MemberRepository memberRepository,
                          UserRepository userRepository,
                          MembershipSubscriptionRepository membershipSubscriptionRepository,
                          ClassEnrollmentRepository classEnrollmentRepository,
                          MembershipService membershipService,
                          PaymentMapper paymentMapper, Clock clock) {
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.membershipSubscriptionRepository = membershipSubscriptionRepository;
        this.membershipService = membershipService;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.paymentMapper = paymentMapper;
        this.clock = clock;
    }

    /** Member requests are pending only; staff retain the existing cashier workflow. */
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
        } else if (!"CENTER_MANAGER".equalsIgnoreCase(principal.role())
                && !"RECEPTIONIST".equalsIgnoreCase(principal.role())) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, null);
        }
        return createPayment(dto);
    }

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
            BigDecimal expectedPrice = subscription.getMembershipPackage().getPrice();
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
        }
    }

    public PaymentDto createPayment(PaymentCreateDto dto) {
        Member member = memberRepository.findById(dto.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", dto.getMemberId()));

        User receiver = null;
        if (dto.getReceivedById() != null) {
            receiver = userRepository.findByIdAndDeletedAtIsNull(dto.getReceivedById())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.cashier", dto.getReceivedById()));
        }

        MembershipSubscription subscription = null;
        if (dto.getSubscriptionId() != null) {
            subscription = validateSubscriptionForPayment(dto.getSubscriptionId(), member, dto.getAmount());
        }

        ClassEnrollment enrollment = null;
        if (dto.getClassEnrollmentId() != null) {
            enrollment = validateClassEnrollmentForPayment(dto.getClassEnrollmentId(), member);
        }

        Payment payment = paymentMapper.toEntity(dto);
        payment.setMember(member);
        payment.setReceivedBy(receiver);

        if (dto.getMethod() != null) {
            payment.setMethod(dto.getMethod().toLowerCase(Locale.ROOT));
        }
        String initialStatus = dto.getStatus() != null ? dto.getStatus().toLowerCase(Locale.ROOT) : "pending";
        payment.setStatus(initialStatus);
        markPaidIfSuccess(payment, initialStatus);

        Payment saved = paymentRepository.save(payment);
        if ("success".equals(initialStatus)) {
            if (subscription != null) {
                membershipService.activateSubscription(subscription);
            }
            if (enrollment != null) {
                enrollment.setStatus("booked");
                classEnrollmentRepository.save(enrollment);
            }
        }
        return paymentMapper.toDto(saved);
    }

    @Transactional(readOnly = true)
    public PaymentDto getPaymentById(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", id));
        return paymentMapper.toDto(payment);
    }

    @Transactional(readOnly = true)
    public List<PaymentDto> getPaymentsByMemberId(Long memberId) {
        if (!memberRepository.existsById(memberId)) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        List<Payment> payments = paymentRepository.findByMemberUserId(memberId);
        return paymentMapper.toDtoList(payments);
    }

    public PaymentDto updatePaymentStatus(Long id, String status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", id));

        if (status == null || !VALID_STATUSES.contains(status.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("INVALID_PAYMENT_STATUS", "finance.payment.invalid_status", new Object[]{status}, null);
        }
        String normalizedStatus = status.toLowerCase(Locale.ROOT);
        String currentStatus = payment.getStatus() != null ? payment.getStatus().toLowerCase(Locale.ROOT) : "pending";

        if (!currentStatus.equals(normalizedStatus)) {
            boolean allowed = switch (currentStatus) {
                case "pending" -> "success".equals(normalizedStatus) || "failed".equals(normalizedStatus);
                case "failed" -> "pending".equals(normalizedStatus);
                case "success" -> "refunded".equals(normalizedStatus);
                default -> false;
            };
            if (!allowed) {
                throw new BadRequestException("INVALID_STATUS_TRANSITION", "finance.payment.invalid_transition",
                        new Object[]{currentStatus, normalizedStatus}, null);
            }
            payment.setStatus(normalizedStatus);
            markPaidIfSuccess(payment, normalizedStatus);
            if ("success".equals(normalizedStatus)) {
                if (payment.getSubscriptionId() != null) {
                    MembershipSubscription subscription = validateSubscriptionForPayment(
                            payment.getSubscriptionId(), payment.getMember(), payment.getAmount());
                    if (subscription != null) {
                        membershipService.activateSubscription(subscription);
                    }
                }
                if (payment.getClassEnrollmentId() != null && classEnrollmentRepository != null) {
                    ClassEnrollment enrollment = validateClassEnrollmentForPayment(
                            payment.getClassEnrollmentId(), payment.getMember());
                    if (enrollment != null) {
                        enrollment.setStatus("booked");
                        classEnrollmentRepository.save(enrollment);
                    }
                }
            }
        }

        return paymentMapper.toDto(payment);
    }

    public PaymentDto processPayment(PaymentProcessDto dto) {
        if (dto.getSubscriptionId() == null && dto.getClassEnrollmentId() == null) {
            throw new BadRequestException("PAYMENT_TARGET_REQUIRED", "finance.payment.target_required", null,
                    "Target subscription or enrollment is required");
        }

        Member member = memberRepository.findById(dto.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", dto.getMemberId()));

        User receiver = null;
        if (dto.getReceivedById() != null) {
            receiver = userRepository.findByIdAndDeletedAtIsNull(dto.getReceivedById())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.cashier", dto.getReceivedById()));
        }

        if (dto.getSubscriptionId() != null) {
            MembershipSubscription subscription = validateSubscriptionForPayment(
                    dto.getSubscriptionId(), member, dto.getAmount());
            if (subscription != null) {
                membershipService.activateSubscription(subscription);
            }
        }

        if (dto.getClassEnrollmentId() != null) {
            ClassEnrollment enrollment = validateClassEnrollmentForPayment(
                    dto.getClassEnrollmentId(), member);
            if (enrollment != null) {
                enrollment.setStatus("booked");
                classEnrollmentRepository.save(enrollment);
            }
        }

        Payment payment = new Payment();
        payment.setMember(member);
        payment.setSubscriptionId(dto.getSubscriptionId());
        payment.setClassEnrollmentId(dto.getClassEnrollmentId());
        payment.setAmount(dto.getAmount());
        payment.setMethod(dto.getMethod() != null ? dto.getMethod().toLowerCase(Locale.ROOT) : "cash");
        payment.setStatus("success");
        payment.setPaidAt(LocalDateTime.now(clock));
        payment.setReceivedBy(receiver);
        payment.setNote(dto.getNote());

        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toDto(saved);
    }

    @Audited(action = "PAYMENT_REFUND", entity = "payments")
    public PaymentDto refundPayment(Long paymentId, PaymentRefundRequest request) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", paymentId));

        String currentStatus = payment.getStatus() != null ? payment.getStatus().toLowerCase(Locale.ROOT) : "";
        if (!"success".equals(currentStatus)) {
            throw new BadRequestException("CANNOT_REFUND_PAYMENT", "finance.payment.cannot_refund",
                    new Object[]{currentStatus}, "Only successful payments can be refunded");
        }

        BigDecimal refundAmount = request.getRefundAmount() != null ? request.getRefundAmount() : payment.getAmount();
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0 || refundAmount.compareTo(payment.getAmount()) > 0) {
            throw new BadRequestException("INVALID_REFUND_AMOUNT", "finance.payment.invalid_refund_amount",
                    new Object[]{refundAmount, payment.getAmount()}, "Invalid refund amount");
        }

        payment.setStatus("refunded");
        String refundNote = "[HOÀN TIỀN: " + refundAmount + " VNĐ] Lý do: " + request.getReason();
        if (payment.getNote() != null && !payment.getNote().isBlank()) {
            payment.setNote(payment.getNote() + " | " + refundNote);
        } else {
            payment.setNote(refundNote);
        }

        // Cancel associated subscription
        if (payment.getSubscriptionId() != null && membershipSubscriptionRepository != null) {
            membershipSubscriptionRepository.findById(payment.getSubscriptionId()).ifPresent(sub -> {
                sub.setStatus("cancelled");
                sub.setUpdatedAt(LocalDateTime.now(clock));
                membershipSubscriptionRepository.save(sub);
            });
        }

        // Cancel associated class enrollment
        if (payment.getClassEnrollmentId() != null && classEnrollmentRepository != null) {
            classEnrollmentRepository.findById(payment.getClassEnrollmentId()).ifPresent(enrollment -> {
                enrollment.setStatus("cancelled");
                enrollment.setCancelReason(request.getReason());
                enrollment.setCancelledAt(LocalDateTime.now(clock));
                classEnrollmentRepository.save(enrollment);
            });
        }

        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toDto(saved);
    }

    private void markPaidIfSuccess(Payment payment, String status) {
        if ("success".equals(status) && payment.getPaidAt() == null) {
            payment.setPaidAt(LocalDateTime.now(clock));
        }
    }

    private MembershipSubscription validateSubscriptionForPayment(Long subscriptionId, Member member, BigDecimal amount) {
        if (subscriptionId == null || membershipSubscriptionRepository == null) {
            return null;
        }
        MembershipSubscription subscription = membershipSubscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (member != null && (subscription.getMember() == null || !subscription.getMember().getUserId().equals(member.getUserId()))) {
            throw new BadRequestException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null,
                    "Subscription does not belong to member");
        }

        if (subscription.getMembershipPackage() != null && subscription.getMembershipPackage().getPrice() != null && amount != null) {
            BigDecimal expectedPrice = subscription.getMembershipPackage().getPrice();
            if (amount.compareTo(expectedPrice) != 0) {
                throw new BadRequestException("PAYMENT_AMOUNT_MISMATCH", "finance.payment.amount_mismatch",
                        new Object[]{amount, expectedPrice}, "Payment amount mismatch");
            }
        }

        return subscription;
    }

    private ClassEnrollment validateClassEnrollmentForPayment(Long classEnrollmentId, Member member) {
        if (classEnrollmentId == null || classEnrollmentRepository == null) {
            return null;
        }
        ClassEnrollment enrollment = classEnrollmentRepository.findById(classEnrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", classEnrollmentId));

        if (member != null && (enrollment.getMember() == null || !enrollment.getMember().getUserId().equals(member.getUserId()))) {
            throw new BadRequestException("PAYMENT_MEMBER_MISMATCH", "finance.payment.member_mismatch", null,
                    "Enrollment does not belong to member");
        }

        return enrollment;
    }
}
