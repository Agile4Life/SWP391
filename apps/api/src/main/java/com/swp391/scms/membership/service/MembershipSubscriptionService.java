package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;<<<<<<<Updated upstream<<<<<<<Updated upstream=======>>>>>>>Stashed changes
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;<<<<<<<Updated upstream
import com.swp391.scms.membership.dto.SubscriptionCreateRequest;
import com.swp391.scms.membership.dto.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.mapper.MembershipSubscriptionMapper;=======
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;>>>>>>>Stashed changes=======
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;>>>>>>>Stashed changes
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;<<<<<<<Updated upstream<<<<<<<Updated upstream
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

@Service
public class MembershipSubscriptionService {

    private static final String PENDING_PAYMENT = "pending_payment";
    private static final String ACTIVE = "active";
    private static final String EXPIRED = "expired";
    private static final int QR_BYTES = 32;
    private static final int QR_GENERATION_ATTEMPTS = 5;
=======
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private static final String PACKAGE_ACTIVE = "active";>>>>>>>
    Stashed changes

    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final MemberRepository members;<<<<<<<
    Updated upstream
    private final MembershipSubscriptionMapper mapper;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();=======
    private final Clock clock;>>>>>>>
    Stashed changes

    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
                                         MembershipPackageRepository packages,
                                         MemberRepository members,
<<<<<<< Updated upstream
                                         MembershipSubscriptionMapper mapper,
=======
>>>>>>> Stashed changes
                                         Clock clock) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.members = members;
<<<<<<< Updated upstream
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional
    public SubscriptionDto create(AuthenticatedPrincipal principal, SubscriptionCreateRequest request) {
        Member member = findMember(principal.id());
        MembershipPackage membershipPackage = findActivePackage(request.packageId());
        LocalDate startDate = LocalDate.now(clock);

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setStartDate(startDate);
        subscription.setEndDate(startDate.plusDays(membershipPackage.getDurationDays()));
        subscription.setStatus(PENDING_PAYMENT);
        subscription.setCreatedBy(member.getUser());

        return mapper.toDto(subscriptions.save(subscription));
    }

    @Transactional
    public SubscriptionDto renew(AuthenticatedPrincipal principal, Long subscriptionId) {
        Member member = findMember(principal.id());
        MembershipSubscription previous = findSubscription(subscriptionId);
        ensureOwner(previous, member.getUserId());

        if (!ACTIVE.equals(previous.getStatus()) && !EXPIRED.equals(previous.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_RENEWAL_INVALID_STATUS",
                    "membership.subscription.invalid_renewal_status",
                    new Object[]{previous.getStatus()},
                    "Subscription cannot be renewed in its current status");
        }

        MembershipPackage membershipPackage = findActivePackage(previous.getMembershipPackage().getId());
        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = !previous.getEndDate().isBefore(today)
=======
        this.clock = clock;
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

        if (subscriptions.existsByMemberUserIdAndStatus(member.getUserId(), STATUS_ACTIVE)) {
            throw new ConflictException(
                    "MEMBERSHIP_ALREADY_ACTIVE",
                    "error.membership.already_active",
                    null,
                    "Member already has an active subscription");
        }

        LocalDate today = LocalDate.now(clock);
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
     * Gia hạn tạo subscription mới liên kết previous_subscription_id ở pending_payment.
     * Nếu gói cũ còn hạn thì start_date mới = end_date cũ + 1 ngày (không mất ngày đã mua).
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

        MembershipPackage membershipPackage = findActivePackage(previous.getMembershipPackage().getId());

        LocalDate today = LocalDate.now(clock);
        LocalDate newStartDate = (previous.getEndDate() != null && !previous.getEndDate().isBefore(today))
>>>>>>> Stashed changes
                ? previous.getEndDate().plusDays(1)
                : today;

        MembershipSubscription renewal = new MembershipSubscription();
<<<<<<< Updated upstream
        renewal.setMember(member);
        renewal.setMembershipPackage(membershipPackage);
        renewal.setPreviousSubscription(previous);
        renewal.setStartDate(startDate);
        renewal.setEndDate(startDate.plusDays(membershipPackage.getDurationDays()));
        renewal.setStatus(PENDING_PAYMENT);
        renewal.setCreatedBy(member.getUser());

        return mapper.toDto(subscriptions.save(renewal));
    }

    @Transactional(readOnly = true)
    public List<SubscriptionDto> getMy(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        return subscriptions.findByMemberUserIdOrderByIdDesc(principal.id()).stream()
                .map(mapper::toDto)
=======
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
     * SCRUM-71 BR-06:
     * Lấy danh sách lịch sử gói tập của chính hội viên.
     */
    @Transactional(readOnly = true)
    public List<SubscriptionDto> mine(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(principal.id()).stream()
                .map(this::toDto)
>>>>>>> Stashed changes
                .toList();
    }

    /**
     * <<<<<<< Updated upstream
     * Called only by the successful-payment flow. There is intentionally no HTTP
     * endpoint for this operation.
     */
    @Transactional
    public SubscriptionDto activateAfterSuccessfulPayment(Long subscriptionId, Long payingMemberId) {
        MembershipSubscription subscription = findSubscription(subscriptionId);
        ensureOwner(subscription, payingMemberId);

        if (!PENDING_PAYMENT.equals(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_ACTIVATION_NOT_PENDING",
                    "membership.subscription.activation_not_pending",
                    new Object[] { subscription.getStatus() },
                    "Only pending subscriptions can be activated after payment");
        }

        MembershipPackage membershipPackage = findActivePackage(subscription.getMembershipPackage().getId());
        LocalDate activationDate = LocalDate.now(clock);
        LocalDate startDate = calculateActivationStart(subscription, activationDate);
        LocalDate endDate = startDate.plusDays(membershipPackage.getDurationDays());

        if (subscriptions.existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                payingMemberId, ACTIVE, endDate, startDate)) {
            throw new ConflictException(
                    "MEMBERSHIP_ACTIVE_OVERLAP",
                    "membership.subscription.active_overlap",
                    null,
                    "Member already has an active subscription covering this period");
        }

        subscription.setMembershipPackage(membershipPackage);
        subscription.setStartDate(startDate);
        subscription.setEndDate(endDate);
        subscription.setQrCode(generateUniqueQrCode());
        subscription.setStatus(ACTIVE);

        try {
            return mapper.toDto(subscriptions.saveAndFlush(subscription));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException(
                    "MEMBERSHIP_ACTIVE_OVERLAP",
                    "membership.subscription.active_overlap",
                    null,
                    "Member already has an active subscription covering this period");
        }
    }

    private LocalDate calculateActivationStart(MembershipSubscription subscription, LocalDate activationDate) {
        MembershipSubscription previous = subscription.getPreviousSubscription();
        if (previous == null || previous.getEndDate().isBefore(activationDate)) {
            return activationDate;
        }
        return previous.getEndDate().plusDays(1);
    }

    private String generateUniqueQrCode() {
        for (int attempt = 0; attempt < QR_GENERATION_ATTEMPTS; attempt++) {
            byte[] bytes = new byte[QR_BYTES];
            secureRandom.nextBytes(bytes);
            String candidate = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            if (subscriptions.findByQrCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new ConflictException(
                "MEMBERSHIP_QR_GENERATION_FAILED",
                "membership.subscription.qr_generation_failed",
                null,
                "Unable to generate a unique QR code");
    }

    private MembershipPackage findActivePackage(Long packageId) {
        MembershipPackage membershipPackage = packages.findById(packageId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.package", packageId));
        if (!"active".equalsIgnoreCase(membershipPackage.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_PACKAGE_INACTIVE",
                    "membership.package.inactive",
                    new Object[] { packageId },
                    "Membership package is inactive");
        }
        return membershipPackage;
    }

    private MembershipSubscription findSubscription(Long subscriptionId) {
        return subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
=======
     * SCRUM-71 BR-01, BR-03:
     * Kích hoạt subscription sau khi thanh toán thành công (được gọi từ workflow thanh toán - SCRUM-76).
     * Chỉ chuyển từ pending_payment sang active.
     * Sinh qr_code ngẫu nhiên

    bảo mật (UUID duy nhất), tính end_date.
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

        LocalDate start = subscription.getStartDate() != null ? subscription.getStartDate() : LocalDate.now(clock);
        subscription.setStartDate(start);
        subscription.setEndDate(start.plusDays(subscription.getMembershipPackage().getDurationDays()));
        subscription.setQrCode(UUID.randomUUID().toString());
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        return toDto(subscriptions.saveAndFlush(subscription));
>>>>>>> Stashed changes
    }

    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    <<<<<<<

    Updated upstream

    private void ensureOwner(MembershipSubscription subscription, Long memberId) {
        if (subscription.getMember() == null || !memberId.equals(subscription.getMember().getUserId())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_SUBSCRIPTION_NOT_OWNER",
                    "membership.subscription.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }
=======
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class MembershipSubscriptionService {
    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final MemberRepository members;
    private final Clock clock;

    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages, MemberRepository members, Clock clock) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.members = members;
        this.clock = clock;
    }

    @Transactional
    public SubscriptionDto create(AuthenticatedPrincipal principal, SubscriptionRequests.Create request) {
        Member member = findMember(principal.id());
        MembershipPackage pack = findActivePackage(request.packageId());
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMember(member);
        sub.setMembershipPackage(pack);
        sub.setStartDate(today);
        sub.setEndDate(today.plusDays(pack.getDurationDays()));
        sub.setStatus("pending_payment");
        return toDto(subscriptions.saveAndFlush(sub));
    }

    @Transactional
    public SubscriptionDto renew(AuthenticatedPrincipal principal, Long previousId) {
        MembershipSubscription previous = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("membership subscription", previousId));
        if (previous.getMember() == null || !previous.getMember().getUserId().equals(principal.id())) {
            throw new BadRequestException("MEMBERSHIP_SUBSCRIPTION_NOT_OWNED",
                    "error.membership.subscription_not_found", null, "Subscription not found");
        }
        MembershipPackage pack = findActivePackage(previous.getMembershipPackage().getId());
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMember(previous.getMember());
        sub.setMembershipPackage(pack);
        sub.setPreviousSubscription(previous);
        sub.setStartDate(today);
        sub.setEndDate(today.plusDays(pack.getDurationDays()));
        sub.setStatus("pending_payment");
        return toDto(subscriptions.saveAndFlush(sub));
    }

    @Transactional(readOnly = true)
    public List<SubscriptionDto> mine(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(principal.id()).stream().map(this::toDto).toList();
    }

    /**
     * Called by the trusted payment-confirmation workflow only; never expose as a
     * member endpoint.
     */
    @Transactional
    public SubscriptionDto activateAfterPayment(Long subscriptionId) {
        MembershipSubscription sub = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("membership subscription", subscriptionId));
        if (!"pending_payment".equals(sub.getStatus())) {
            throw new BadRequestException("MEMBERSHIP_SUBSCRIPTION_NOT_PENDING",
                    "error.membership.subscription_not_active", null, "Subscription is not pending payment");
        }
        LocalDate start = LocalDate.now(clock);
        sub.setStartDate(start);
        sub.setEndDate(start.plusDays(sub.getMembershipPackage().getDurationDays()));
        sub.setQrCode(UUID.randomUUID().toString());
        sub.setStatus("active");
        return toDto(subscriptions.saveAndFlush(sub));
    }

    private Member findMember(Long id) {
        return members.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.member", id));
    }

    private MembershipPackage findActivePackage(Long id) {
        MembershipPackage pack = packages.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("membership package", id));
        if (!"active".equalsIgnoreCase(pack.getStatus()) || pack.getDurationDays() <= 0) {
            throw new BadRequestException("MEMBERSHIP_PACKAGE_INACTIVE", "error.membership.package_inactive", null,
                    "Membership package is inactive");
        }
        return pack;
    }

    private SubscriptionDto toDto(MembershipSubscription s) {
        return new SubscriptionDto(s.getId(), s.getMember().getUserId(), s.getMembershipPackage().getId(),
                s.getMembershipPackage().getName(), s.getPreviousSubscription() == null ? null : s.getPreviousSubscription().getId(),
                s.getStartDate(), s.getEndDate(), s.getStatus(), s.getQrCode(), s.getCreatedAt());
>>>>>>> Stashed changes
=======

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
                s.getCreatedAt()
        );
>>>>>>> Stashed changes
    }
}
