package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.CatalogSeeder;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.HoldRequestDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipCancellationRequestRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service managing membership subscriptions (SCRUM-71).
 */
@Service
public class MembershipSubscriptionService {

    private static final String STATUS_PENDING_PAYMENT = "pending_payment";
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_FROZEN = "frozen";
    private static final String STATUS_EXPIRED = "expired";
    private static final String PACKAGE_ACTIVE = "active";

    private static final String HOLD_PENDING = "PENDING";
    private static final String HOLD_APPROVED = "APPROVED";
    /** Longest a membership may stay frozen; later it resumes on its own with this many days added back. */
    public static final int MAX_HOLD_DAYS = 90;
    /** Shortest hold a member may request. */
    public static final int MIN_HOLD_DAYS = 3;
    /** A hold request must be filed at least this long before its first day. */
    public static final int HOLD_NOTICE_HOURS = 24;
    public static final long MAX_HOLD_DOCUMENT_BYTES = 5L * 1024 * 1024;
    public static final int MAX_HOLD_DOCUMENTS = 5;
    private static final java.util.Set<String> HOLD_DOCUMENT_TYPES =
            java.util.Set.of("image/jpeg", "image/png", "application/pdf");
    private static final String HOLD_REJECTED = "REJECTED";

    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final MemberRepository members;
    private final Clock clock;
    private final DynamicQrService dynamicQrService;
    private final EnrollmentService enrollmentService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;

    @Autowired(required = false)
    private PaymentRepository paymentRepository;

    @Autowired(required = false)
    private com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    @Autowired(required = false)
    private EntitlementRevocationService entitlementRevocation;

    @Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipHoldDocumentRepository holdDocuments;

    @Autowired(required = false)
    private com.swp391.scms.attendance.service.CourseAttendanceService courseAttendance;

    @Autowired(required = false)
    private MembershipCancellationRequestRepository cancellationRequests;

    @Autowired(required = false)
    private EntityManager entityManager;

    @Autowired(required = false)
    private SubscriptionValueCalculator valueCalculator;

    @Autowired(required = false)
    private com.swp391.scms.membership.repository.MemberTrialRedemptionRepository trialRedemptionRepository;

    public void setTrialRedemptionRepository(com.swp391.scms.membership.repository.MemberTrialRedemptionRepository repo) {
        this.trialRedemptionRepository = repo;
    }

    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock) {
        this(subscriptions, packages, members, clock, new DynamicQrService(), null, null, null, null);
    }

    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock,
            DynamicQrService dynamicQrService) {
        this(subscriptions, packages, members, clock, dynamicQrService, null, null, null, null);
    }

    @Autowired
    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock,
            @Autowired(required = false) DynamicQrService dynamicQrService,
            @Autowired(required = false) EnrollmentService enrollmentService,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) NotificationService notificationService,
            @Autowired(required = false) MessageService messageService) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.members = members;
        this.clock = clock;
        this.dynamicQrService = dynamicQrService != null ? dynamicQrService : new DynamicQrService();
        this.enrollmentService = enrollmentService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * SCRUM-71 BR-01, BR-02, BR-04:
     * Tạo subscription mới ở trạng thái pending_payment.
     * Chỉ mua gói có status active.
     * Một hội viên chỉ có tối đa 1 subscription active tại một thời điểm.
     */
    @Transactional
    public SubscriptionDto create(AuthenticatedPrincipal principal, SubscriptionRequests.Create request) {
        Member member = findMember(principal.id());
        MembershipPackage membershipPackage = findActivePackage(request.packageId());
        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (subscriptions.existsByMemberUserIdAndStatus(member.getUserId(), STATUS_FROZEN)) {
            throw new ConflictException("MEMBERSHIP_FROZEN_EXISTS", "error.membership.frozen_exists", null, null);
        }

        LocalDate today = LocalDate.now(clock);
        if (subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(member.getUserId(), STATUS_ACTIVE,
                today)) {
            throw new ConflictException(
                    "MEMBERSHIP_ALREADY_ACTIVE",
                    "error.membership.already_active",
                    null,
                    "Member already has an active subscription");
        }
        if (subscriptions.existsByMemberUserIdAndStatus(member.getUserId(), STATUS_PENDING_PAYMENT)) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }

        // Kiểm tra KYC bắt buộc trước khi đăng ký gói tập đầu tiên
        if (trialRedemptionRepository != null) {
            boolean hasPriorSubscriptions = subscriptions.existsByMemberUserId(member.getUserId());
            boolean hasApprovedTrial = trialRedemptionRepository.findByMemberUserId(member.getUserId())
                    .map(t -> com.swp391.scms.membership.entity.MemberTrialRedemption.STATUS_APPROVED.equalsIgnoreCase(t.getStatus()))
                    .orElse(false);
            boolean isIdentityVerified = Boolean.TRUE.equals(member.getIdentityVerified()) || hasApprovedTrial;

            if (!hasPriorSubscriptions && !isIdentityVerified && "PENDING".equals(member.getKycStatus())) {
                throw new BadRequestException("MEMBERSHIP_KYC_PENDING", "error.membership.kyc_pending", null,
                        msg("error.membership.kyc_pending"));
            }
            if (!hasPriorSubscriptions && !isIdentityVerified) {
                throw new BadRequestException("MEMBERSHIP_KYC_REQUIRED", "error.membership.kyc_required", null,
                        msg("error.membership.kyc_required"));
            }
        }

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        int durationDays = Math.max(1, membershipPackage.getDurationDays());
        subscription.setStartDate(today);
        subscription.setEndDate(today.plusDays(durationDays - 1L));
        // Giá chốt lúc tạo yêu cầu, giống báo giá nâng cấp: Quản lý đổi giá sau đó không làm đổi số tiền phải thu.
        subscription.setQuotedPrice(membershipPackage.getPrice());
        subscription.setStatus(STATUS_PENDING_PAYMENT);
        subscription.setCreatedAt(LocalDateTime.now(clock));
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(subscription));
    }

    /**
     * SCRUM-71 BR-05, BR-06:
     * Gia hạn tạo subscription mới liên kết previous_subscription_id ở
     * pending_payment.
     * Nếu gói cũ còn hạn thì start_date mới = end_date cũ + 1 ngày (không mất ngày
     * đã mua).
     * Nếu đã hết hạn thì bắt đầu từ ngày hôm nay.
     */
    @Transactional
    public SubscriptionDto renew(AuthenticatedPrincipal principal, Long previousId) {
        MembershipSubscription requested = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", previousId));
        ensureOwner(requested, principal);
        return renewForOwner(requested, principal.id(), previousId);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionDto> renewalCandidatesForStaff(AuthenticatedPrincipal principal, Long memberId) {
        ensureReceptionStaff(principal);
        Member member = findMember(memberId);
        if (member.getUser() == null || member.getUser().getDeletedAt() != null) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(memberId).stream()
                .filter(this::isPaidPeriod).map(this::toDto).toList();
    }

    @Transactional
    public SubscriptionDto renewForMember(AuthenticatedPrincipal principal, Long memberId, Long previousId) {
        ensureReceptionStaff(principal);
        MembershipSubscription requested = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", previousId));
        if (requested.getMember() == null || !memberId.equals(requested.getMember().getUserId())) {
            throw new ForbiddenException("MEMBERSHIP_NOT_OWNER", "error.membership.not_owner", null, null);
        }
        if (requested.getMember().getUser() != null && requested.getMember().getUser().getDeletedAt() != null) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return renewForOwner(requested, memberId, previousId);
    }

    private void ensureReceptionStaff(AuthenticatedPrincipal principal) {
        if (principal == null || !("RECEPTIONIST".equalsIgnoreCase(principal.role())
                || "CENTER_MANAGER".equalsIgnoreCase(principal.role()))) {
            throw new ForbiddenException("MEMBERSHIP_FORBIDDEN", "error.forbidden", null, null);
        }
    }

    private SubscriptionDto renewForOwner(MembershipSubscription requested, Long memberId, Long previousId) {
        if (!isPaidPeriod(requested)) {
            throw new BadRequestException("MEMBERSHIP_INVALID_RENEWAL_STATUS",
                    "membership.subscription.invalid_renewal_status", new Object[]{requested.getStatus()},
                    "Only a paid subscription can be renewed");
        }
        // Serialize all renewal requests for this member, then read the chain afresh.
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (entityManager != null) entityManager.refresh(requested);
        if (HOLD_PENDING.equalsIgnoreCase(requested.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending", null,
                    "Subscription already has a pending hold request");
        }
        List<MembershipSubscription> history = subscriptions.findByMemberUserId(memberId);
        if (history.stream().anyMatch(item -> STATUS_ACTIVE.equalsIgnoreCase(item.getStatus())
                && HOLD_PENDING.equalsIgnoreCase(item.getHoldStatus()))) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending", null,
                    "Subscription already has a pending hold request");
        }
        List<MembershipSubscription> paidPeriods = history.stream().filter(this::isPaidPeriod).toList();
        for (MembershipSubscription item : paidPeriods) {
            long siblings = paidPeriods.stream().filter(other -> other.getPreviousSubscription() != null
                    && item.getPreviousSubscription() != null
                    && item.getPreviousSubscription().getId().equals(other.getPreviousSubscription().getId()))
                    .count();
            if (siblings > 1) throw renewalConflict();
        }
        for (int i = 0; i < paidPeriods.size(); i++) {
            MembershipSubscription a = paidPeriods.get(i);
            if (!validPeriod(a)) throw renewalConflict();
            for (int j = i + 1; j < paidPeriods.size(); j++) {
                MembershipSubscription b = paidPeriods.get(j);
                if (!validPeriod(b) || (!a.getStartDate().isAfter(b.getEndDate())
                        && !a.getEndDate().isBefore(b.getStartDate())
                        && !isUpgradeTransition(a, b))) throw renewalConflict();
            }
        }
        MembershipSubscription tail = history.stream().filter(item -> previousId.equals(item.getId()))
                .findFirst().orElseThrow(this::renewalConflict);
        if (!isPaidPeriod(tail) || !validPeriod(tail)) throw renewalConflict();
        if (history.stream().anyMatch(item -> STATUS_PENDING_PAYMENT.equalsIgnoreCase(item.getStatus()))) {
            throw new ConflictException("MEMBERSHIP_PENDING_EXISTS", "error.membership.pending_exists", null,
                    "A subscription is still awaiting payment");
        }
        if (history.stream().anyMatch(item -> STATUS_FROZEN.equalsIgnoreCase(item.getStatus()))) throw renewalConflict();
        java.util.Set<Long> visited = new java.util.HashSet<>();
        while (true) {
            if (!visited.add(tail.getId())) throw renewalConflict();
            Long tailId = tail.getId();
            List<MembershipSubscription> next = history.stream()
                    .filter(item -> item.getPreviousSubscription() != null
                            && tailId.equals(item.getPreviousSubscription().getId()) && isPaidPeriod(item))
                    .toList();
            if (next.size() > 1) throw renewalConflict();
            if (next.isEmpty()) break;
            MembershipSubscription successor = next.get(0);
            if (!validPeriod(successor) || !successor.getStartDate().isAfter(tail.getEndDate())
                    || successor.getMembershipPackage() == null || tail.getMembershipPackage() == null
                    || !successor.getMembershipPackage().getId().equals(tail.getMembershipPackage().getId())) {
                throw renewalConflict();
            }
            tail = successor;
        }
        MembershipPackage membershipPackage = findActivePackage(tail.getMembershipPackage().getId());
        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = tail.getEndDate().isBefore(today) ? today : tail.getEndDate().plusDays(1);
        LocalDate endDate = startDate.plusDays(Math.max(1, membershipPackage.getDurationDays()) - 1L);
        for (MembershipSubscription item : history) {
            if (isPaidPeriod(item) && validPeriod(item)
                    && !item.getStartDate().isAfter(endDate) && !item.getEndDate().isBefore(startDate)) {
                throw renewalConflict();
            }
        }
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setMember(tail.getMember());
        renewal.setMembershipPackage(membershipPackage);
        renewal.setPreviousSubscription(tail);
        renewal.setStartDate(startDate);
        renewal.setEndDate(endDate);
        renewal.setQuotedPrice(membershipPackage.getPrice());
        renewal.setStatus(STATUS_PENDING_PAYMENT);
        renewal.setCreatedAt(LocalDateTime.now(clock));
        renewal.setUpdatedAt(LocalDateTime.now(clock));
        return toDto(subscriptions.saveAndFlush(renewal));
    }

    private void ensureOwner(MembershipSubscription subscription, AuthenticatedPrincipal principal) {
        if (principal == null || subscription.getMember() == null || !principal.id().equals(subscription.getMember().getUserId())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }
    }

    private boolean isActiveOn(MembershipSubscription subscription, LocalDate date) {
        return STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                && validPeriod(subscription)
                && !subscription.getStartDate().isAfter(date)
                && !subscription.getEndDate().isBefore(date);
    }

    private boolean isPaidPeriod(MembershipSubscription subscription) {
        return subscription != null && (STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                || "expired".equalsIgnoreCase(subscription.getStatus()));
    }

    private boolean validPeriod(MembershipSubscription subscription) {
        return subscription.getStartDate() != null && subscription.getEndDate() != null
                && !subscription.getEndDate().isBefore(subscription.getStartDate());
    }

    private boolean isUpgradeTransition(MembershipSubscription a, MembershipSubscription b) {
        MembershipSubscription newer = b.getPreviousSubscription() != null
                && a.getId().equals(b.getPreviousSubscription().getId()) ? b
                : a.getPreviousSubscription() != null
                && b.getId().equals(a.getPreviousSubscription().getId()) ? a : null;
        MembershipSubscription older = newer == b ? a : newer == a ? b : null;
        return older != null && older.getMembershipPackage() != null
                && newer.getMembershipPackage() != null
                && (!older.getMembershipPackage().getId().equals(newer.getMembershipPackage().getId())
                    || newer.getUpgradeCharge() != null)
                && older.getEndDate().equals(newer.getStartDate());
    }

    private ConflictException renewalConflict() {
        return new ConflictException("MEMBERSHIP_RENEWAL_CONFLICT", "error.membership.renewal_conflict",
                null, "Subscription chain needs review before renewal");
    }

    /**
     * Nâng cấp gói tập đang hoạt động lên gói tập cao hơn (chờ lễ tân xác nhận thanh toán tại quầy).
     */
    @Transactional
    public SubscriptionDto upgrade(AuthenticatedPrincipal principal, Long currentId, SubscriptionRequests.Upgrade request) {
        MembershipSubscription current = subscriptions.findById(currentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", currentId));

        ensureOwner(current, principal);

        members.findByUserIdForUpdate(current.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", current.getMember().getUserId()));
        if (entityManager != null) entityManager.refresh(current);
        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(current, today)) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_REQUIRES_ACTIVE",
                    "error.membership.upgrade_requires_active",
                    null,
                    "Only an active subscription can be upgraded");
        }

        if (HOLD_PENDING.equalsIgnoreCase(current.getHoldStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending",
                    null,
                    "Subscription already has a pending hold request");
        }

        if (subscriptions.existsByMemberUserIdAndStatus(current.getMember().getUserId(), STATUS_PENDING_PAYMENT)
                || subscriptions.existsByPreviousSubscriptionIdAndStatusIn(currentId,
                        List.of(STATUS_PENDING_PAYMENT, STATUS_ACTIVE))) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }

        if (hasPaidFutureRenewal(current.getMember().getUserId(), today)) throw futurePaidConflict();

        MembershipPackage targetPackage = findActivePackage(request.packageId());
        MembershipPackage currentPackage = current.getMembershipPackage();
        BigDecimal targetPrice = targetPackage.getPrice() != null ? targetPackage.getPrice() : BigDecimal.ZERO;
        boolean trialUpgradeToPaid = isTrialSubscription(current) && targetPrice.signum() > 0;

        if (!trialUpgradeToPaid && !isHigherPackage(currentPackage, targetPackage)) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_NOT_HIGHER",
                    "error.membership.upgrade_not_higher",
                    null,
                    "Target package must be higher than current package");
        }

        // Phần quy đổi lấy từ tiền hội viên thực trả cho kỳ hiện tại; giá gói mới lấy theo danh mục lúc báo giá.
        // Cả hai được chốt trên yêu cầu nên Quản lý đổi giá sau đó không làm lệch số tiền phải thu.
        BigDecimal credit = valueCalculator().remainingValue(current, today);
        BigDecimal charge = SubscriptionValueCalculator.upgradeCharge(targetPrice, credit);
        if (charge.signum() <= 0) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_CREDIT_EXCEEDS",
                    "error.membership.upgrade_credit_exceeds",
                    new Object[]{credit.toPlainString(), targetPrice.toPlainString()},
                    "Unused value of the current period already covers the target package");
        }

        MembershipSubscription upgradeSub = new MembershipSubscription();
        upgradeSub.setMember(current.getMember());
        upgradeSub.setMembershipPackage(targetPackage);
        upgradeSub.setPreviousSubscription(current);
        int durationDays = Math.max(1, targetPackage.getDurationDays());
        // Ngày bắt đầu là ngày báo giá: phần quy đổi tính tới hôm nay, nên gói mới cũng tính từ hôm nay.
        upgradeSub.setStartDate(today);
        upgradeSub.setEndDate(today.plusDays(durationDays - 1L));
        upgradeSub.setCreditApplied(credit);
        upgradeSub.setUpgradeCharge(charge);
        upgradeSub.setStatus(STATUS_PENDING_PAYMENT);
        upgradeSub.setCreatedAt(LocalDateTime.now(clock));
        upgradeSub.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(upgradeSub));
    }

    /**
     * Hủy yêu cầu gói tập đang ở trạng thái chờ thanh toán (pending_payment).
     * Hội viên (chủ sở hữu) hoặc Lễ tân / Quản lý đều có thể hủy khi chưa thanh toán.
     */
    @Transactional
    public SubscriptionDto cancelPending(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        boolean isStaff = principal != null && ("CENTER_MANAGER".equalsIgnoreCase(principal.role())
                || "RECEPTIONIST".equalsIgnoreCase(principal.role())
                || "MANAGER".equalsIgnoreCase(principal.role())
                || "STAFF".equalsIgnoreCase(principal.role()));
        boolean isOwner = principal != null
                && lookup.getMember() != null
                && lookup.getMember().getUserId().equals(principal.id());

        if (!isStaff && !isOwner) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }

        Long memberId = lookup.getMember().getUserId();
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        if (entityManager != null) entityManager.refresh(subscription);

        if ("cancelled".equalsIgnoreCase(subscription.getStatus())) {
            return toDto(subscription);
        }

        if (!STATUS_PENDING_PAYMENT.equalsIgnoreCase(subscription.getStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_CANCEL_NOT_PENDING",
                    "error.membership.cancel_not_pending",
                    null,
                    "Only a pending payment subscription can be cancelled");
        }

        if (paymentRepository != null) {
            List<com.swp391.scms.finance.entity.Payment> subPayments = paymentRepository.findAllBySubscriptionId(subscriptionId);
            if (subPayments.stream().anyMatch(payment -> "success".equalsIgnoreCase(payment.getStatus()))) {
                throw new ConflictException("MEMBERSHIP_CANCEL_PAYMENT_UNSETTLED",
                        "error.membership.cancel_payment_unsettled", null, null);
            }
            // A VNPay attempt the gateway may still settle blocks everyone; an abandoned one is closed here.
            if (vnpayGuard != null) vnpayGuard.subscription(subscriptionId);
            // A member may withdraw an unpaid online checkout; a cash receipt under review is decided by reception.
            if (!isStaff && subPayments.stream().anyMatch(payment -> "pending".equalsIgnoreCase(payment.getStatus())
                    && !"online_wallet".equalsIgnoreCase(payment.getMethod()))) {
                throw new ConflictException("MEMBERSHIP_CANCEL_PAYMENT_UNSETTLED",
                        "error.membership.cancel_payment_unsettled", null, null);
            }
            subPayments.stream()
                    .filter(payment -> "pending".equalsIgnoreCase(payment.getStatus()))
                    .forEach(payment -> {
                        payment.setStatus("failed");
                        paymentRepository.save(payment);
                    });
        }

        subscription.setStatus("cancelled");
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(subscription));
    }

    private SubscriptionValueCalculator valueCalculator() {
        return valueCalculator != null ? valueCalculator : new SubscriptionValueCalculator(paymentRepository);
    }

    private boolean isHigherPackage(MembershipPackage currentPackage, MembershipPackage targetPackage) {
        if (currentPackage == null || targetPackage == null) {
            return false;
        }
        if (currentPackage.getId() != null && currentPackage.getId().equals(targetPackage.getId())) {
            return false;
        }
        BigDecimal currentPrice = currentPackage.getPrice() != null ? currentPackage.getPrice() : BigDecimal.ZERO;
        BigDecimal targetPrice = targetPackage.getPrice() != null ? targetPackage.getPrice() : BigDecimal.ZERO;
        int priceComparison = targetPrice.compareTo(currentPrice);
        if (priceComparison > 0) {
            return true;
        }
        if (priceComparison == 0) {
            return targetPackage.getDurationDays() > currentPackage.getDurationDays();
        }
        return false;
    }

    /**
     * Hội viên chủ động gửi yêu cầu bảo lưu gói tập đang hoạt động kèm lý do.
     */
    @Transactional
    public SubscriptionDto requestHold(AuthenticatedPrincipal principal, Long subscriptionId, SubscriptionRequests.HoldRequest request) {
        return requestHold(principal, subscriptionId, request, null);
    }

    /**
     * Files a hold request (spec 2026-11-09, section 1.6): the package must allow holds and not have used its one hold,
     * the dates must start at least 24 hours away and last between 3 days and the package allowance, and medical
     * paperwork must be attached.
     */
    @Transactional
    public SubscriptionDto requestHold(AuthenticatedPrincipal principal, Long subscriptionId,
                                       SubscriptionRequests.HoldRequest request, List<HoldDocumentUpload> documents) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        ensureOwner(subscription, principal);

        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (entityManager != null) entityManager.refresh(subscription);

        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(subscription, today)) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REQUIRES_ACTIVE",
                    "error.membership.hold_requires_active",
                    null,
                    "Only an active subscription can be placed on hold");
        }

        if (isTrialSubscription(subscription)) {
            throw new BadRequestException(
                    "MEMBERSHIP_TRIAL_CANNOT_HOLD",
                    "error.membership.trial_cannot_hold",
                    null,
                    "Gói tập trải nghiệm không hỗ trợ bảo lưu.");
        }

        if (HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending",
                    null,
                    "Subscription already has a pending hold request");
        }

        ensureNoPendingOrCancellationHoldConflicts(principal.id(), subscriptionId, today);

        String reason = request != null && request.reason() != null ? request.reason().trim() : "";
        if (reason.isEmpty()) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REASON_REQUIRED",
                    "validation.membership.hold_reason.not_blank",
                    null,
                    "Hold reason is required");
        }
        if (reason.length() > 500) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REASON_TOO_LONG",
                    "validation.membership.hold_reason.size",
                    null,
                    "Hold reason must not exceed 500 characters");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        validateHoldWindow(subscription, request, documents, now);
        subscription.setHoldStartDate(request.startDate());
        subscription.setHoldEndDate(request.endDate());
        subscription.setHoldStatus(HOLD_PENDING);
        subscription.setHoldReason(reason);
        subscription.setHoldRequestedAt(now);
        subscription.setHoldResolvedAt(null);
        subscription.setHoldResolvedBy(null);
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);
        storeHoldDocuments(saved, principal, documents);
        return toDto(saved);
    }

    /** Bytes of one uploaded medical document, already read from the multipart request. */
    public record HoldDocumentUpload(String fileName, String contentType, byte[] content) {}

    private void validateHoldWindow(MembershipSubscription subscription, SubscriptionRequests.HoldRequest request,
                                    List<HoldDocumentUpload> documents, LocalDateTime now) {
        int maxDays = com.swp391.scms.facilities.PackageBenefits.holdMaxDays(subscription.getMembershipPackage());
        if (maxDays <= 0) {
            throw new BadRequestException("MEMBERSHIP_HOLD_NOT_ALLOWED", "error.membership.hold_not_allowed", null,
                    "This package cannot be put on hold");
        }
        if (subscription.isHoldUsed()) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_USED", "error.membership.hold_already_used", null,
                    "A package can be put on hold only once");
        }
        LocalDate start = request == null ? null : request.startDate();
        LocalDate end = request == null ? null : request.endDate();
        if (start == null || end == null || end.isBefore(start)) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DATES_INVALID", "error.membership.hold_dates_invalid", null,
                    "Hold start and end dates are required and the end cannot be before the start");
        }
        if (start.atStartOfDay().isBefore(now.plusHours(HOLD_NOTICE_HOURS))) {
            throw new BadRequestException("MEMBERSHIP_HOLD_TOO_LATE", "error.membership.hold_too_late",
                    new Object[]{HOLD_NOTICE_HOURS}, "A hold must be requested at least 24 hours before it starts");
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        if (days < MIN_HOLD_DAYS || days > maxDays) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DURATION_INVALID", "error.membership.hold_duration_invalid",
                    new Object[]{MIN_HOLD_DAYS, maxDays}, "A hold must last between 3 days and the package allowance");
        }
        if (subscription.getStartDate() == null || subscription.getEndDate() == null
                || start.isBefore(subscription.getStartDate()) || end.isAfter(subscription.getEndDate())) {
            throw new BadRequestException("MEMBERSHIP_HOLD_OUT_OF_PERIOD", "error.membership.hold_out_of_period", null,
                    "The hold must fall inside the membership period");
        }
        if (documents == null || documents.isEmpty()) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DOCUMENT_REQUIRED", "error.membership.hold_document_required",
                    null, "Medical paperwork is required for a hold request");
        }
        if (documents.size() > MAX_HOLD_DOCUMENTS) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DOCUMENT_INVALID", "error.membership.hold_document_invalid",
                    new Object[]{MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES / (1024 * 1024)}, "Too many documents");
        }
        for (HoldDocumentUpload document : documents) {
            if (document == null || document.content() == null || document.content().length == 0
                    || document.content().length > MAX_HOLD_DOCUMENT_BYTES
                    || document.contentType() == null
                    || !HOLD_DOCUMENT_TYPES.contains(document.contentType().toLowerCase(java.util.Locale.ROOT))) {
                throw new BadRequestException("MEMBERSHIP_HOLD_DOCUMENT_INVALID", "error.membership.hold_document_invalid",
                        new Object[]{MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES / (1024 * 1024)},
                        "Documents must be JPG, PNG or PDF files of at most 5 MB");
            }
        }
    }

    private void storeHoldDocuments(MembershipSubscription subscription, AuthenticatedPrincipal principal,
                                    List<HoldDocumentUpload> documents) {
        if (holdDocuments == null || documents == null) return;
        holdDocuments.deleteBySubscriptionId(subscription.getId());
        for (HoldDocumentUpload upload : documents) {
            var document = new com.swp391.scms.membership.entity.MembershipHoldDocument();
            document.setSubscription(subscription);
            String name = upload.fileName() == null || upload.fileName().isBlank() ? "document" : upload.fileName().trim();
            document.setFileName(name.length() > 255 ? name.substring(name.length() - 255) : name);
            document.setContentType(upload.contentType().toLowerCase(java.util.Locale.ROOT));
            document.setSizeBytes(upload.content().length);
            document.setContent(upload.content());
            document.setUploadedAt(LocalDateTime.now(clock));
            if (principal != null && principal.id() != null && userRepository != null) {
                userRepository.findById(principal.id()).ifPresent(document::setUploadedBy);
            }
            holdDocuments.save(document);
        }
    }

    private void ensureNoPendingOrCancellationHoldConflicts(Long memberId, Long subscriptionId, LocalDate today) {
        if (subscriptions.existsByMemberUserIdAndStatus(memberId, STATUS_PENDING_PAYMENT)) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }
        if (hasPaidFutureRenewal(memberId, today)) {
            throw futurePaidConflict();
        }
        if (cancellationRequests != null
                && cancellationRequests.existsBySubscriptionIdAndStatus(subscriptionId, "PENDING")) {
            throw new ConflictException(
                    "CANCELLATION_PENDING_EXISTS",
                    "error.membership.cancellation_pending_exists",
                    null,
                    "A cancellation request is already pending for this membership");
        }
    }

    @Transactional
    public SubscriptionDto resume(AuthenticatedPrincipal principal, Long subscriptionId) {
        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        if (entityManager != null) entityManager.refresh(subscription);
        ensureOwner(subscription, principal);
        LocalDate today = LocalDate.now(clock);
        LocalDate heldOn = subscription.getHoldStartDate() != null ? subscription.getHoldStartDate()
                : subscription.getHoldResolvedAt() == null ? null : subscription.getHoldResolvedAt().toLocalDate();
        if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                || heldOn == null || heldOn.isAfter(today) || !validPeriod(subscription)
                || heldOn.isBefore(subscription.getStartDate()) || heldOn.isAfter(subscription.getEndDate())) {
            throw new BadRequestException("MEMBERSHIP_RESUME_INVALID", "error.membership.resume_invalid", null, null);
        }
        if (subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(principal.id(), STATUS_ACTIVE, today)
                || subscriptions.existsByMemberUserIdAndStatus(principal.id(), STATUS_PENDING_PAYMENT)
                || hasPaidFutureRenewal(principal.id(), today)) {
            throw new ConflictException("MEMBERSHIP_RESUME_CONFLICT", "error.membership.resume_conflict", null, null);
        }
        // Preserve the original paid period and class-credit usage; only extend its expiry, by at most MAX_HOLD_DAYS.
        long heldDays = Math.min(java.time.temporal.ChronoUnit.DAYS.between(heldOn, today), MAX_HOLD_DAYS);
        subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setHoldStatus(null);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        MembershipSubscription resumed = subscriptions.saveAndFlush(subscription);
        // Coming back early: the rest of the hold window no longer excuses course sessions.
        if (courseAttendance != null) courseAttendance.releaseHoldExcuses(principal.id(), today);
        return toDto(resumed);
    }

    /** Frozen memberships whose hold reached MAX_HOLD_DAYS. */
    @Transactional(readOnly = true)
    public List<Long> findHoldsDueForResume() {
        LocalDateTime cutoff = LocalDateTime.now(clock).minusDays(MAX_HOLD_DAYS);
        return subscriptions.findByStatusAndHoldStatusAndHoldResolvedAtLessThanEqual(STATUS_FROZEN, HOLD_APPROVED, cutoff)
                .stream().filter(sub -> sub.getHoldEndDate() == null).map(MembershipSubscription::getId).toList();
    }

    /** Frozen memberships whose dated hold ended before today. */
    @Transactional(readOnly = true)
    public List<Long> findDatedHoldsDueForResume() {
        return subscriptions.findDatedHoldsDueForResume(LocalDate.now(clock));
    }

    /** Approved holds whose first day has arrived but are still counted as active memberships. */
    @Transactional(readOnly = true)
    public List<Long> findHoldsDueToStart() {
        return subscriptions.findHoldsDueToStart(LocalDate.now(clock));
    }

    /** Freezes an approved hold on its first day; the bookings of the window were already released at approval. */
    @Transactional
    public boolean startHold(Long subscriptionId) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId).orElse(null);
        if (lookup == null || lookup.getMember() == null) return false;
        members.findByUserIdForUpdate(lookup.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", lookup.getMember().getUserId()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId).orElse(null);
        if (subscription == null) return false;
        if (entityManager != null) entityManager.refresh(subscription);
        LocalDate today = LocalDate.now(clock);
        if (!STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                || subscription.getHoldStartDate() == null || subscription.getHoldStartDate().isAfter(today)) {
            return false;
        }
        subscription.setStatus(STATUS_FROZEN);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        subscriptions.saveAndFlush(subscription);
        return true;
    }

    /** Ends a hold that reached MAX_HOLD_DAYS: the membership runs again with those days added to its expiry. */
    @Transactional
    public boolean autoResumeHold(Long subscriptionId) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId).orElse(null);
        if (lookup == null || lookup.getMember() == null) return false;
        members.findByUserIdForUpdate(lookup.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", lookup.getMember().getUserId()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId).orElse(null);
        if (subscription == null) return false;
        if (entityManager != null) entityManager.refresh(subscription);
        LocalDateTime now = LocalDateTime.now(clock);
        long heldDays;
        if (subscription.getHoldEndDate() != null) {
            // Dated hold: it covers its first to last day inclusive and ends the day after.
            if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                    || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                    || subscription.getEndDate() == null
                    || !subscription.getHoldEndDate().isBefore(now.toLocalDate())) {
                return false;
            }
            LocalDate from = subscription.getHoldStartDate() != null ? subscription.getHoldStartDate()
                    : subscription.getHoldEndDate();
            heldDays = java.time.temporal.ChronoUnit.DAYS.between(from, subscription.getHoldEndDate()) + 1;
        } else {
            if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                    || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                    || subscription.getHoldResolvedAt() == null || subscription.getEndDate() == null
                    || subscription.getHoldResolvedAt().isAfter(now.minusDays(MAX_HOLD_DAYS))) {
                return false;
            }
            heldDays = Math.min(java.time.temporal.ChronoUnit.DAYS.between(
                    subscription.getHoldResolvedAt().toLocalDate(), now.toLocalDate()), MAX_HOLD_DAYS);
        }
        subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setHoldStatus(null);
        subscription.setUpdatedAt(now);
        subscriptions.saveAndFlush(subscription);
        if (notificationService != null) {
            String pkgName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
            notificationService.send(subscription.getMember().getUserId(),
                    msg("notifications.membership.hold_auto_resumed.title"),
                    msg("notifications.membership.hold_auto_resumed.body", pkgName, heldDays, subscription.getEndDate()),
                    "system", "membership_subscription", subscription.getId());
        }
        return true;
    }

    /**
     * Danh sách yêu cầu bảo lưu đang chờ lễ tân xử lý.
     */
    @Transactional(readOnly = true)
    public List<HoldRequestDto> listPendingHolds() {
        LocalDate today = LocalDate.now(clock);
        return subscriptions.findByHoldStatusOrderByHoldRequestedAtDesc(HOLD_PENDING).stream()
                .filter(s -> s.getMember() != null
                        && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null
                        && isActiveOn(s, today))
                .map(s -> toHoldRequestDto(s, 0))
                .toList();
    }

    /** Every hold request and hold history row for the desk screens; {@code status} filters PENDING/APPROVED/REJECTED/COMPLETED. */
    @Transactional(readOnly = true)
    public List<HoldRequestDto> listHolds(String status) {
        String wanted = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? null : status.trim().toUpperCase(java.util.Locale.ROOT);
        return subscriptions.findAllWithHoldHistory().stream()
                .filter(s -> s.getMember() != null && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null)
                .filter(s -> wanted == null || wanted.equals(effectiveHoldStatus(s)))
                .map(s -> toHoldRequestDto(s, 0))
                .toList();
    }

    /** Hold details of one subscription for its owner or desk staff. */
    @Transactional(readOnly = true)
    public HoldRequestDto getHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwnerOrDesk(subscription, principal);
        return toHoldRequestDto(subscription, 0);
    }

    /** A document of a hold request, for its owner or desk staff only. */
    @Transactional(readOnly = true)
    public com.swp391.scms.membership.entity.MembershipHoldDocument getHoldDocument(
            AuthenticatedPrincipal principal, Long subscriptionId, Long documentId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwnerOrDesk(subscription, principal);
        if (holdDocuments == null) throw new ResourceNotFoundException("resource.hold_document", documentId);
        return holdDocuments.findById(documentId)
                .filter(document -> document.getSubscription() != null
                        && subscriptionId.equals(document.getSubscription().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("resource.hold_document", documentId));
    }

    /** The hold allowance of a subscription of the authenticated member. */
    @Transactional(readOnly = true)
    public com.swp391.scms.membership.dto.SubscriptionResponses.HoldPolicyDto holdPolicy(
            AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwner(subscription, principal);
        int maxDays = com.swp391.scms.facilities.PackageBenefits.holdMaxDays(subscription.getMembershipPackage());
        return new com.swp391.scms.membership.dto.SubscriptionResponses.HoldPolicyDto(
                maxDays > 0, subscription.isHoldUsed(), MIN_HOLD_DAYS, maxDays, HOLD_NOTICE_HOURS,
                MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES);
    }

    /** The member withdraws a hold request that has not been decided yet. */
    @Transactional
    public SubscriptionDto cancelHoldRequest(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwner(subscription, principal);
        return withdrawHold(subscription);
    }

    /**
     * Desk staff withdraw a hold on behalf of a member (the member asked at the counter): a pending request, or an
     * approved hold that has not started. The member is notified.
     */
    @Transactional
    public SubscriptionDto withdrawHoldForMember(AuthenticatedPrincipal principal, Long subscriptionId) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        if (!"RECEPTIONIST".equals(role) && !"CENTER_MANAGER".equals(role) && !"MANAGER".equals(role)) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only the front desk can withdraw a hold for a member");
        }
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        Long memberId = subscription.getMember() != null ? subscription.getMember().getUserId() : null;
        String packageName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
        SubscriptionDto result = withdrawHold(subscription);
        if (notificationService != null && memberId != null) {
            notificationService.send(memberId, msg("notifications.membership.hold_withdrawn_by_desk.title"),
                    msg("notifications.membership.hold_withdrawn_by_desk.body", packageName),
                    "system", "membership_subscription", subscriptionId);
        }
        return result;
    }

    private SubscriptionDto withdrawHold(MembershipSubscription subscription) {
        Long subscriptionId = subscription.getId();
        LocalDate today = LocalDate.now(clock);
        boolean approvedNotStarted = HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                && STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                && subscription.getHoldStartDate() != null && subscription.getHoldStartDate().isAfter(today);
        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus()) && !approvedNotStarted) {
            throw new BadRequestException("MEMBERSHIP_HOLD_NOT_PENDING", "error.membership.hold_not_pending", null,
                    "Subscription does not have a hold request that can still be withdrawn");
        }
        if (approvedNotStarted) {
            // The hold never started, so the package gets its one hold back. Bookings released at approval stay released.
            subscription.setHoldUsed(false);
            if (courseAttendance != null) courseAttendance.releaseHoldExcuses(subscription.getMember().getUserId(), subscription.getHoldStartDate());
        }
        if (holdDocuments != null) holdDocuments.deleteBySubscriptionId(subscriptionId);
        subscription.setHoldStatus(null);
        subscription.setHoldReason(null);
        subscription.setHoldRequestedAt(null);
        subscription.setHoldStartDate(null);
        subscription.setHoldEndDate(null);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        return toDto(subscriptions.saveAndFlush(subscription));
    }

    private void ensureOwnerOrDesk(MembershipSubscription subscription, AuthenticatedPrincipal principal) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        if ("RECEPTIONIST".equals(role) || "CENTER_MANAGER".equals(role) || "MANAGER".equals(role)) return;
        ensureOwner(subscription, principal);
    }

    private static String effectiveHoldStatus(MembershipSubscription s) {
        if (s.getHoldStatus() != null) return s.getHoldStatus().toUpperCase(java.util.Locale.ROOT);
        return s.isHoldUsed() ? "COMPLETED" : null;
    }

    /**
     * Lễ tân duyệt yêu cầu bảo lưu: chuyển gói tập sang trạng thái frozen và tự động hủy các lịch học đã đặt trong tương lai.
     */
    @Transactional
    public HoldRequestDto approveHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        Long memberId = subscription.getMember().getUserId();
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (entityManager != null) entityManager.refresh(subscription);
        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())
                || !STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_NOT_PENDING",
                    "error.membership.hold_not_pending",
                    null,
                    "Subscription does not have a pending hold request");
        }

        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(subscription, today)) {
            throw new BadRequestException("MEMBERSHIP_HOLD_REQUIRES_ACTIVE",
                    "error.membership.hold_requires_active", null, null);
        }
        ensureNoPendingOrCancellationHoldConflicts(memberId, subscriptionId, today);

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate holdStart = subscription.getHoldStartDate();
        LocalDate holdEnd = subscription.getHoldEndDate();
        if (holdStart != null && holdEnd != null) {
            if (holdEnd.isBefore(today)) {
                throw new BadRequestException("MEMBERSHIP_HOLD_WINDOW_PASSED", "error.membership.hold_window_passed", null,
                        "The requested hold period has already passed");
            }
            if (holdStart.isBefore(today)) {
                // Approved late: the days the member already lived through are not held, so no days are added for them.
                holdStart = today;
                subscription.setHoldStartDate(today);
            }
        }
        // A dated hold stays active until its first day; the daily sweep freezes it then.
        if (holdStart == null || !holdStart.isAfter(today)) {
            subscription.setStatus(STATUS_FROZEN);
        }
        subscription.setHoldUsed(true);
        subscription.setHoldStatus(HOLD_APPROVED);
        subscription.setHoldResolvedAt(now);
        if (principal != null && principal.id() != null && userRepository != null) {
            userRepository.findById(principal.id()).ifPresent(subscription::setHoldResolvedBy);
        }
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);

        int cancelledCount = 0;
        if (saved.getMember() != null && saved.getMember().getUserId() != null) {
            String cancelReason = msg("scheduling.enrollment.cancelled_by_hold");
            if (holdStart != null && holdEnd != null) {
                // Only the held window is released; course seats are kept and their sessions become excused.
                if (entitlementRevocation != null) {
                    cancelledCount = entitlementRevocation.releaseBookingsBetween(
                            saved.getMember().getUserId(), holdStart, holdEnd, cancelReason);
                }
                if (courseAttendance != null) {
                    courseAttendance.excuseSessionsBetween(saved.getMember().getUserId(), holdStart, holdEnd);
                }
            } else if (entitlementRevocation != null) {
                // A frozen period covers no date, so classes, 1:1 sessions and courts are all released.
                cancelledCount = entitlementRevocation.revokeUncoveredBookings(saved.getMember().getUserId(), cancelReason);
            } else if (enrollmentService != null) {
                cancelledCount = enrollmentService.cancelFutureEnrollmentsForMember(
                        saved.getMember().getUserId(), cancelReason);
            }
        }

        if (notificationService != null && saved.getMember() != null && saved.getMember().getUserId() != null) {
            String pkgName = saved.getMembershipPackage() != null ? saved.getMembershipPackage().getName() : "";
            notificationService.send(
                    saved.getMember().getUserId(),
                    msg("notifications.membership.hold_approved.title"),
                    msg("notifications.membership.hold_approved.body", pkgName, cancelledCount),
                    "system",
                    "membership_subscription",
                    saved.getId());
        }

        return toHoldRequestDto(saved, cancelledCount);
    }

    /**
     * Lễ tân từ chối yêu cầu bảo lưu: giữ nguyên trạng thái gói tập active.
     */
    @Transactional
    public HoldRequestDto rejectHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (subscription.getMember() != null && subscription.getMember().getUserId() != null) {
            members.findByUserIdForUpdate(subscription.getMember().getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", subscription.getMember().getUserId()));
        }
        if (entityManager != null) entityManager.refresh(subscription);

        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_NOT_PENDING",
                    "error.membership.hold_not_pending",
                    null,
                    "Subscription does not have a pending hold request");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        subscription.setHoldStatus(HOLD_REJECTED);
        subscription.setHoldResolvedAt(now);
        if (principal != null && principal.id() != null && userRepository != null) {
            userRepository.findById(principal.id()).ifPresent(subscription::setHoldResolvedBy);
        }
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);

        if (notificationService != null && saved.getMember() != null && saved.getMember().getUserId() != null) {
            String pkgName = saved.getMembershipPackage() != null ? saved.getMembershipPackage().getName() : "";
            notificationService.send(
                    saved.getMember().getUserId(),
                    msg("notifications.membership.hold_rejected.title"),
                    msg("notifications.membership.hold_rejected.body", pkgName),
                    "system",
                    "membership_subscription",
                    saved.getId());
        }

        return toHoldRequestDto(saved, 0);
    }

    /**
     * SCRUM-71 BR-01, BR-06:
     * Lấy subscription active hiện tại (start_date <= today <= end_date) của hội viên kèm mã QR định danh.
     * Không chọn nhầm các gói gia hạn trong tương lai (start_date > today).
     * Trả về null nếu hội viên chưa có gói hoặc gói đã hết hạn.
     */
    @Transactional(readOnly = true)
    public SubscriptionDto current(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        LocalDate today = LocalDate.now(clock);
        return subscriptions.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                        principal.id(), STATUS_ACTIVE, today, today)
                .map(current -> toDto(current, paidThroughDate(current,
                        subscriptions.findByMemberUserId(principal.id()))))
                .orElse(null);
    }

    private LocalDate paidThroughDate(MembershipSubscription current, List<MembershipSubscription> history) {
        MembershipSubscription tail = current;
        java.util.Set<Long> visited = new java.util.HashSet<>();
        while (visited.add(tail.getId())) {
            Long tailId = tail.getId();
            List<MembershipSubscription> successors = history.stream()
                    .filter(item -> item.getPreviousSubscription() != null
                            && tailId.equals(item.getPreviousSubscription().getId())
                            && STATUS_ACTIVE.equalsIgnoreCase(item.getStatus()))
                    .toList();
            if (successors.size() != 1) break;
            MembershipSubscription next = successors.get(0);
            if (visited.contains(next.getId()) || !validPeriod(next)
                    || !next.getStartDate().equals(tail.getEndDate().plusDays(1))
                    || next.getMembershipPackage() == null || tail.getMembershipPackage() == null
                    || !next.getMembershipPackage().getId().equals(tail.getMembershipPackage().getId())) break;
            tail = next;
        }
        return tail.getEndDate();
    }

    /**
     * SCRUM-71 BR-06:
     * Lấy danh sách lịch sử gói tập của chính hội viên.
     */
    @Transactional(readOnly = true)
    public List<SubscriptionDto> mine(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(principal.id()).stream()
                .map(this::toDto)
                .toList();
    }

    private boolean hasPaidFutureRenewal(Long memberId, LocalDate today) {
        return subscriptions.findByMemberUserId(memberId).stream()
                .anyMatch(item -> item.getPreviousSubscription() != null
                        && isPaidPeriod(item) && item.getStartDate() != null
                        && item.getStartDate().isAfter(today));
    }

    private ConflictException futurePaidConflict() {
        return new ConflictException("MEMBERSHIP_FUTURE_PAID_RENEWAL",
                "error.membership.future_paid_renewal", null,
                "Paid future renewal requires manager review");
    }

    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    private MembershipPackage findActivePackage(Long packageId) {
        MembershipPackage membershipPackage = packages.findById(packageId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.package", packageId));
        if (!PACKAGE_ACTIVE.equalsIgnoreCase(membershipPackage.getStatus())
                || membershipPackage.getDurationDays() <= 0) {
            throw new BadRequestException(
                    "MEMBERSHIP_PACKAGE_INACTIVE",
                    "error.membership.package_inactive",
                    null,
                    "Membership package is inactive");
        }
        return membershipPackage;
    }

    @Transactional(readOnly = true)
    public List<com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto> listPending() {
        return subscriptions.findByStatusOrderByCreatedAtDesc(STATUS_PENDING_PAYMENT).stream()
                .filter(s -> s.getMember() != null
                        && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null)
                .map(this::toPendingDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public com.swp391.scms.membership.dto.SubscriptionResponses.DynamicQrDto generateDynamicQr(AuthenticatedPrincipal principal) {
        SubscriptionDto sub = current(principal);
        if (sub == null || !STATUS_ACTIVE.equalsIgnoreCase(sub.status())) {
            throw new BadRequestException(
                    "MEMBERSHIP_NOT_ACTIVE",
                    "error.attendance.subscription_not_active",
                    null,
                    "No active subscription found to generate dynamic QR");
        }
        long nowMillis = clock.instant().toEpochMilli();
        String qr = dynamicQrService.generate(principal.id(), sub.id(), nowMillis);
        return new com.swp391.scms.membership.dto.SubscriptionResponses.DynamicQrDto(
                qr, dynamicQrService.getTtlSeconds(), LocalDateTime.now(clock));
    }

    private SubscriptionDto toDto(MembershipSubscription s) {
        return toDto(s, null);
    }

    private SubscriptionDto toDto(MembershipSubscription s, LocalDate paidThroughDate) {
        String pkgName;
        if (isTrialSubscription(s)) {
            pkgName = CatalogSeeder.TRIAL_PACKAGE_NAME;
        } else {
            pkgName = s.getMembershipPackage() != null ? s.getMembershipPackage().getName() : null;
        }
        return new SubscriptionDto(
                s.getId(),
                s.getMember() != null ? s.getMember().getUserId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getId() : null,
                pkgName,
                s.getPreviousSubscription() != null ? s.getPreviousSubscription().getId() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getQrCode(),
                s.getCreatedAt(),
                s.getHoldStatus(),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                paidThroughDate,
                s.getUpgradeCharge(),
                s.getQuotedPrice(),
                s.getCreditApplied(),
                isActiveOn(s, LocalDate.now(clock)) ? valueCalculator().remainingValue(s, LocalDate.now(clock)) : null);
    }

    private com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto toPendingDto(MembershipSubscription s) {
        Member m = s.getMember();
        com.swp391.scms.users.entity.User u = m != null ? m.getUser() : null;
        MembershipPackage pkg = s.getMembershipPackage();
        BigDecimal payablePrice = s.payableAmount();
        if (paymentRepository != null) {
            var pendingPayments = paymentRepository.findAllBySubscriptionId(s.getId()).stream()
                    .filter(payment -> "pending".equalsIgnoreCase(payment.getStatus())
                            && payment.getMember() != null && m != null
                            && m.getUserId().equals(payment.getMember().getUserId()))
                    .toList();
            if (pendingPayments.size() == 1) payablePrice = pendingPayments.getFirst().getAmount();
        }
        return new com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto(
                s.getId(),
                m != null ? m.getUserId() : null,
                m != null ? m.getMembershipCode() : null,
                u != null ? u.getFullName() : null,
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                pkg != null ? pkg.getId() : null,
                pkg != null ? pkg.getName() : null,
                pkg != null ? pkg.getDurationDays() : null,
                payablePrice,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getCreatedAt());
    }

    private List<com.swp391.scms.membership.dto.SubscriptionResponses.HoldDocumentDto> holdDocumentDtos(MembershipSubscription s) {
        if (holdDocuments == null || s.getId() == null) return List.of();
        return holdDocuments.findBySubscriptionIdOrderByIdAsc(s.getId()).stream()
                .map(d -> new com.swp391.scms.membership.dto.SubscriptionResponses.HoldDocumentDto(
                        d.getId(), d.getFileName(), d.getContentType(), d.getSizeBytes(), d.getUploadedAt()))
                .toList();
    }

    private HoldRequestDto toHoldRequestDto(MembershipSubscription s, int cancelledEnrollmentsCount) {
        Member m = s.getMember();
        com.swp391.scms.users.entity.User u = m != null ? m.getUser() : null;
        MembershipPackage pkg = s.getMembershipPackage();
        return new HoldRequestDto(
                s.getId(),
                m != null ? m.getUserId() : null,
                m != null ? m.getMembershipCode() : null,
                u != null ? u.getFullName() : null,
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                pkg != null ? pkg.getId() : null,
                pkg != null ? pkg.getName() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                effectiveHoldStatus(s),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                cancelledEnrollmentsCount,
                s.getHoldStartDate(),
                s.getHoldEndDate(),
                holdDocumentDtos(s));
    }

    private boolean isTrialSubscription(MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getMembershipPackage() != null) {
            String name = sub.getMembershipPackage().getName();
            if (name != null) {
                String upper = name.toUpperCase(java.util.Locale.ROOT);
                if (upper.contains("TRẢI NGHIỆM") || upper.contains("TRIAL")) return true;
            }
            if (sub.getMembershipPackage().getDurationDays() > 0 && sub.getMembershipPackage().getDurationDays() <= 3) return true;
        }
        if (sub.getStartDate() != null && sub.getEndDate() != null) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(sub.getStartDate(), sub.getEndDate());
            if (days <= 3) return true;
        }
        return false;
    }
}
