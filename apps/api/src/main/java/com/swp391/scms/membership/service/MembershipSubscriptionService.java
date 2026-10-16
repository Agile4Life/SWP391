package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
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
    private static final String PACKAGE_ACTIVE = "active";

    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final MemberRepository members;
    private final Clock clock;

    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.members = members;
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

        LocalDate today = LocalDate.now(clock);
        if (subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(member.getUserId(), STATUS_ACTIVE,
                today)) {
            throw new ConflictException(
                    "MEMBERSHIP_ALREADY_ACTIVE",
                    "error.membership.already_active",
                    null,
                    "Member already has an active subscription");
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
     * SCRUM-71 BR-01, BR-06:
     * Lấy subscription active hiện tại (chưa hết hạn) của hội viên kèm mã QR định
     * danh.
     * Trả về null nếu hội viên chưa có gói hoặc gói đã hết hạn.
     */
    @Transactional(readOnly = true)
    public SubscriptionDto current(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        LocalDate today = LocalDate.now(clock);
        return subscriptions.findFirstByMemberUserIdAndStatusOrderByEndDateDesc(principal.id(), STATUS_ACTIVE)
                .filter(sub -> sub.getEndDate() == null || !sub.getEndDate().isBefore(today))
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

        LocalDate start = subscription.getStartDate() != null ? subscription.getStartDate() : LocalDate.now(clock);
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
                s.getCreatedAt());
    }
}
