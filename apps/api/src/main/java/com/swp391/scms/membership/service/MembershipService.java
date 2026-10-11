package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

@Service
@Transactional
public class MembershipService {

    private static final String PENDING_PAYMENT = "pending_payment";
    private static final String ACTIVE = "active";
    private static final int QR_BYTES = 32;
    private static final int QR_GENERATION_ATTEMPTS = 5;

    private final MembershipSubscriptionRepository membershipSubscriptionRepository;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public MembershipService(MembershipSubscriptionRepository membershipSubscriptionRepository, Clock clock) {
        this.membershipSubscriptionRepository = membershipSubscriptionRepository;
        this.clock = clock;
    }

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
                        "Member already has an active subscription during this period");
            }
        }

        subscription.setStartDate(activationStartDate);
        subscription.setEndDate(endDate);
        subscription.setStatus(ACTIVE);
        subscription.setQrCode(generateQrCode());
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        membershipSubscriptionRepository.save(subscription);
    }

    private String generateQrCode() {
        for (int i = 0; i < QR_GENERATION_ATTEMPTS; i++) {
            byte[] bytes = new byte[QR_BYTES];
            secureRandom.nextBytes(bytes);
            String candidate = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            if (membershipSubscriptionRepository.findByQrCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        return UUID.randomUUID().toString();
    }
}