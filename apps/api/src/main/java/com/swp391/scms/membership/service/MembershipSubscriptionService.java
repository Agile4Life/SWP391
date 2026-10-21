package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.HoldRequestDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
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

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setStartDate(today);
        subscription.setEndDate(today.plusDays(membershipPackage.getDurationDays()));
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
        MembershipSubscription previous = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", previousId));

        if (previous.getMember() == null || !previous.getMember().getUserId().equals(principal.id())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }

        if (STATUS_PENDING_PAYMENT.equalsIgnoreCase(previous.getStatus())
                || "cancelled".equalsIgnoreCase(previous.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_INVALID_RENEWAL_STATUS",
                    "membership.subscription.invalid_renewal_status",
                    new Object[]{previous.getStatus()},
                    "Subscription with status " + previous.getStatus() + " cannot be renewed");
        }

        if (subscriptions.existsByPreviousSubscriptionIdAndStatusIn(previousId,
                List.of(STATUS_PENDING_PAYMENT, STATUS_ACTIVE))) {
            throw new ConflictException(
                    "MEMBERSHIP_ALREADY_RENEWED",
                    "error.membership.already_renewed",
                    null,
                    "Subscription has already been renewed");
        }

        MembershipPackage membershipPackage = findActivePackage(previous.getMembershipPackage().getId());

        LocalDate today = LocalDate.now(clock);
        LocalDate newStartDate = (previous.getEndDate() != null && !previous.getEndDate().isBefore(today))
                ? previous.getEndDate().plusDays(1)
                : today;

        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setMember(previous.getMember());
        renewal.setMembershipPackage(membershipPackage);
        renewal.setPreviousSubscription(previous);
        renewal.setStartDate(newStartDate);
        renewal.setEndDate(newStartDate.plusDays(membershipPackage.getDurationDays()));
        renewal.setStatus(STATUS_PENDING_PAYMENT);
        renewal.setCreatedAt(LocalDateTime.now(clock));
        renewal.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(renewal));
    }

    /**
     * Nâng cấp gói tập đang hoạt động lên gói tập cao hơn (chờ lễ tân xác nhận thanh toán tại quầy).
     */
    @Transactional
    public SubscriptionDto upgrade(AuthenticatedPrincipal principal, Long currentId, SubscriptionRequests.Upgrade request) {
        MembershipSubscription current = subscriptions.findById(currentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", currentId));

        if (current.getMember() == null || !current.getMember().getUserId().equals(principal.id())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }

        LocalDate today = LocalDate.now(clock);
        if (!STATUS_ACTIVE.equalsIgnoreCase(current.getStatus())
                || (current.getEndDate() != null && current.getEndDate().isBefore(today))) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_REQUIRES_ACTIVE",
                    "error.membership.upgrade_requires_active",
                    null,
                    "Only an active subscription can be upgraded");
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

        MembershipPackage targetPackage = findActivePackage(request.packageId());
        MembershipPackage currentPackage = current.getMembershipPackage();

        if (!isHigherPackage(currentPackage, targetPackage)) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_NOT_HIGHER",
                    "error.membership.upgrade_not_higher",
                    null,
                    "Target package must be higher than current package");
        }

        MembershipSubscription upgradeSub = new MembershipSubscription();
        upgradeSub.setMember(current.getMember());
        upgradeSub.setMembershipPackage(targetPackage);
        upgradeSub.setPreviousSubscription(current);
        int durationDays = Math.max(1, targetPackage.getDurationDays());
        upgradeSub.setStartDate(today);
        upgradeSub.setEndDate(today.plusDays(durationDays - 1L));
        upgradeSub.setStatus(STATUS_PENDING_PAYMENT);
        upgradeSub.setCreatedAt(LocalDateTime.now(clock));
        upgradeSub.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(upgradeSub));
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
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (subscription.getMember() == null || !subscription.getMember().getUserId().equals(principal.id())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }

        LocalDate today = LocalDate.now(clock);
        if (!STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                || (subscription.getEndDate() != null && subscription.getEndDate().isBefore(today))) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REQUIRES_ACTIVE",
                    "error.membership.hold_requires_active",
                    null,
                    "Only an active subscription can be placed on hold");
        }

        if (HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending",
                    null,
                    "Subscription already has a pending hold request");
        }

        String reason = request != null && request.reason() != null ? request.reason().trim() : "";
        if (reason.isEmpty()) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REASON_REQUIRED",
                    "validation.membership.hold_reason.not_blank",
                    null,
                    "Hold reason is required");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        subscription.setHoldStatus(HOLD_PENDING);
        subscription.setHoldReason(reason);
        subscription.setHoldRequestedAt(now);
        subscription.setHoldResolvedAt(null);
        subscription.setHoldResolvedBy(null);
        subscription.setUpdatedAt(now);

        return toDto(subscriptions.saveAndFlush(subscription));
    }

    /**
     * Danh sách yêu cầu bảo lưu đang chờ lễ tân xử lý.
     */
    @Transactional(readOnly = true)
    public List<HoldRequestDto> listPendingHolds() {
        return subscriptions.findByHoldStatusOrderByHoldRequestedAtDesc(HOLD_PENDING).stream()
                .filter(s -> s.getMember() != null
                        && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null)
                .map(s -> toHoldRequestDto(s, 0))
                .toList();
    }

    /**
     * Lễ tân duyệt yêu cầu bảo lưu: chuyển gói tập sang trạng thái frozen và tự động hủy các lịch học đã đặt trong tương lai.
     */
    @Transactional
    public HoldRequestDto approveHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())
                || !STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_NOT_PENDING",
                    "error.membership.hold_not_pending",
                    null,
                    "Subscription does not have a pending hold request");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        subscription.setStatus(STATUS_FROZEN);
        subscription.setHoldStatus(HOLD_APPROVED);
        subscription.setHoldResolvedAt(now);
        if (principal != null && principal.id() != null && userRepository != null) {
            userRepository.findById(principal.id()).ifPresent(subscription::setHoldResolvedBy);
        }
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);

        int cancelledCount = 0;
        if (enrollmentService != null && saved.getMember() != null && saved.getMember().getUserId() != null) {
            String cancelReason = msg("scheduling.enrollment.cancelled_by_hold");
            cancelledCount = enrollmentService.cancelFutureEnrollmentsForMember(
                    saved.getMember().getUserId(), cancelReason);
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
                .map(this::toDto)
                .orElse(null);
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

    /**
     * SCRUM-71 BR-01, BR-03:
     * Kích hoạt subscription sau khi thanh toán thành công (được gọi từ workflow
     * thanh toán - SCRUM-76).
     * Chỉ chuyển từ pending_payment sang active.
     * Sinh qr_code ngẫu nhiên bảo mật (UUID duy nhất), tính end_date.
     */
    @Transactional
    public SubscriptionDto activateAfterPayment(Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (!STATUS_PENDING_PAYMENT.equals(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_NOT_PENDING",
                    "error.membership.not_pending",
                    null,
                    "Subscription is not pending payment");
        }

        LocalDate today = LocalDate.now(clock);
        MembershipSubscription previous = subscription.getPreviousSubscription();
        boolean isUpgrade = previous != null
                && subscription.getMembershipPackage() != null
                && previous.getMembershipPackage() != null
                && previous.getMembershipPackage().getId() != null
                && !previous.getMembershipPackage().getId().equals(subscription.getMembershipPackage().getId());

        if (isUpgrade && STATUS_ACTIVE.equalsIgnoreCase(previous.getStatus())) {
            previous.setStatus(STATUS_EXPIRED);
            if (previous.getEndDate() != null && previous.getEndDate().isAfter(today)) {
                previous.setEndDate(today);
            }
            previous.setUpdatedAt(LocalDateTime.now(clock));
            subscriptions.save(previous);
        }

        LocalDate start = isUpgrade ? today : (subscription.getStartDate() != null ? subscription.getStartDate() : today);
        subscription.setStartDate(start);
        subscription.setEndDate(start.plusDays(subscription.getMembershipPackage().getDurationDays()));
        subscription.setQrCode(UUID.randomUUID().toString());
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(subscription));
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

    private SubscriptionDto toDto(MembershipSubscription s) {
        return new SubscriptionDto(
                s.getId(),
                s.getMember() != null ? s.getMember().getUserId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getName() : null,
                s.getPreviousSubscription() != null ? s.getPreviousSubscription().getId() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getQrCode(),
                s.getCreatedAt(),
                s.getHoldStatus(),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt());
    }

    private com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto toPendingDto(MembershipSubscription s) {
        Member m = s.getMember();
        com.swp391.scms.users.entity.User u = m != null ? m.getUser() : null;
        MembershipPackage pkg = s.getMembershipPackage();
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
                pkg != null ? pkg.getPrice() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getCreatedAt());
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
                s.getHoldStatus(),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                cancelledEnrollmentsCount);
    }
}

