package com.swp391.scms.membership.service;

<<<<<<<Updated upstream

import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;=======
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.MembershipSubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;>>>>>>>Stashed changes
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;<<<<<<<Updated upstream
import java.util.Base64;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;=======
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;>>>>>>>Stashed changes

@Service
@Transactional
public class MembershipService {

    private static final String PENDING_PAYMENT = "pending_payment";
    private static final String ACTIVE = "active";
    private static final int QR_BYTES = 32;
    private static final int QR_GENERATION_ATTEMPTS = 5;

    private final MembershipSubscriptionRepository membershipSubscriptionRepository;<<<<<<<
    Updated upstream
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public MembershipService(MembershipSubscriptionRepository membershipSubscriptionRepository, Clock clock) {
        this.membershipSubscriptionRepository = membershipSubscriptionRepository;
        this.clock = clock;
    }

    =======

    private final MembershipPackageRepository membershipPackageRepository;
    private final MemberRepository memberRepository;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public MembershipService(MembershipSubscriptionRepository membershipSubscriptionRepository,
            MembershipPackageRepository membershipPackageRepository,
            MemberRepository memberRepository,
            Clock clock) {
        this.membershipSubscriptionRepository = membershipSubscriptionRepository;
        this.membershipPackageRepository = membershipPackageRepository;
        this.memberRepository = memberRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MembershipSubscriptionDto> getMySubscriptions(Long memberUserId) {
        return membershipSubscriptionRepository.findByMemberUserId(memberUserId).stream()
                .sorted(Comparator.comparing(MembershipSubscription::getCreatedAt).reversed())
                .map(MembershipSubscriptionDto::from)
                .toList();
    }

    @Transactional
    public MembershipSubscriptionDto createSubscription(Long packageId, Long memberUserId) {
        Member member = memberRepository.findById(memberUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberUserId));
        MembershipPackage membershipPackage = membershipPackageRepository.findById(packageId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.package", packageId));

        if (!"active".equalsIgnoreCase(membershipPackage.getStatus())) {
            throw new BadRequestException("MEMBERSHIP_PACKAGE_INACTIVE", "membership.package.inactive",
                    new Object[] { packageId }, "Membership package is inactive");
        }

        boolean hasActive = membershipSubscriptionRepository.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(
                memberUserId, ACTIVE, LocalDate.now(clock));
        if (hasActive) {
            throw new ConflictException("MEMBERSHIP_ACTIVE_OVERLAP", "membership.subscription.active_overlap", null,
                    "Member already has an active subscription");
        }

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setStatus(PENDING_PAYMENT);
        subscription.setStartDate(LocalDate.now(clock));
        subscription.setEndDate(LocalDate.now(clock));
        subscription.setCreatedAt(LocalDateTime.now(clock));
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        return MembershipSubscriptionDto.from(membershipSubscriptionRepository.save(subscription));
    }

    @Transactional
    public MembershipSubscriptionDto renewSubscription(Long subscriptionId, Long memberUserId) {
        MembershipSubscription current = membershipSubscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (!current.getMember().getUserId().equals(memberUserId)) {
            throw new ForbiddenException("FORBIDDEN", "membership.subscription.renew_forbidden", null,
                    "You can only renew your own subscription");
        }

        MembershipPackage packageToRenew = current.getMembershipPackage();
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setMember(current.getMember());
        renewal.setMembershipPackage(packageToRenew);
        renewal.setPreviousSubscription(current);
        renewal.setStatus(PENDING_PAYMENT);

        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = today;
        if (current.getEndDate() != null && !current.getEndDate().isBefore(today)) {
            startDate = current.getEndDate().plusDays(1);
        }

        renewal.setStartDate(startDate);
        renewal.setEndDate(startDate);
        renewal.setCreatedAt(LocalDateTime.now(clock));
        renewal.setUpdatedAt(LocalDateTime.now(clock));

        return MembershipSubscriptionDto.from(membershipSubscriptionRepository.save(renewal));
    }

    >>>>>>>

    Stashed changes

    public void activateSubscription(MembershipSubscription subscription) {
        if (!PENDING_PAYMENT.equals(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_ACTIVATION_NOT_PENDING",
                    "membership.subscription.activation_not_pending",
                    new Object[]{subscription.getStatus()},
                    "Only pending subscriptions can be activated after successful payment");
        }

        if (subscription.getMembershipPackage() == null
                || !"active".equalsIgnoreCase(subscription.getMembershipPackage().getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_PACKAGE_INACTIVE",
                    "membership.package.inactive",
                    new Object[]{subscription.getMembershipPackage() != null
                            ? subscription.getMembershipPackage().getId() : null},
                    "Membership package is inactive");
        }

        LocalDate startDate = LocalDate.now(clock);
        MembershipSubscription previous = subscription.getPreviousSubscription();
        if (previous != null && !previous.getEndDate().isBefore(startDate)) {
            startDate = previous.getEndDate().plusDays(1);
        }
        LocalDate activationStartDate = startDate;
        LocalDate endDate = activationStartDate.plusDays(subscription.getMembershipPackage().getDurationDays());

        if (subscription.getMember() != null) {
            boolean overlapsActiveSubscription = membershipSubscriptionRepository
                    .findByMemberUserIdAndStatus(subscription.getMember().getUserId(), ACTIVE)
                    .stream()
                    .anyMatch(active -> !active.getStartDate().isAfter(endDate)
                            && !active.getEndDate().isBefore(activationStartDate));
            if (overlapsActiveSubscription) {
                throw new ConflictException(
                        "MEMBERSHIP_ACTIVE_OVERLAP",
                        "membership.subscription.active_overlap",
                        null,
                        "Member already has an active subscription covering this period");
            }
        }

        subscription.setStartDate(activationStartDate);
        subscription.setEndDate(endDate);
<<<<<<< Updated upstream
        subscription.setStatus("active");
=======
        subscription.setStatus(ACTIVE);
>>>>>>> Stashed changes
        subscription.setQrCode(generateUniqueQrCode());
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        membershipSubscriptionRepository.save(subscription);
    }

    private String generateUniqueQrCode() {
        for (int attempt = 0; attempt < QR_GENERATION_ATTEMPTS; attempt++) {
            byte[] bytes = new byte[QR_BYTES];
            secureRandom.nextBytes(bytes);
            String candidate = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            if (membershipSubscriptionRepository.findByQrCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new ConflictException(
                "MEMBERSHIP_QR_GENERATION_FAILED",
                "membership.subscription.qr_generation_failed",
                null,
                "Unable to generate a unique QR code");
    }
}