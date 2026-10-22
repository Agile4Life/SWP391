package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;

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

    @Autowired
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

        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = today;
        MembershipSubscription previous = subscription.getPreviousSubscription();
        boolean isUpgrade = previous != null
                && subscription.getMembershipPackage() != null
                && previous.getMembershipPackage() != null
                && previous.getMembershipPackage().getId() != null
                && !previous.getMembershipPackage().getId().equals(subscription.getMembershipPackage().getId());

        if (isUpgrade && ACTIVE.equalsIgnoreCase(previous.getStatus())) {
            previous.setStatus("expired");
            if (previous.getEndDate() != null && previous.getEndDate().isAfter(today)) {
                previous.setEndDate(today);
            }
            previous.setUpdatedAt(LocalDateTime.now(clock));
            membershipSubscriptionRepository.save(previous);
        } else if (previous != null && previous.getEndDate() != null && !previous.getEndDate().isBefore(startDate)) {
            startDate = previous.getEndDate().plusDays(1);
        }

        LocalDate activationStartDate = startDate;
        LocalDate endDate = activationStartDate.plusDays(subscription.getMembershipPackage().getDurationDays());

        Long prevId = previous != null ? previous.getId() : null;
        if (subscription.getMember() != null) {
            boolean overlapsActiveSubscription = membershipSubscriptionRepository
                    .findByMemberUserIdAndStatus(subscription.getMember().getUserId(), ACTIVE)
                    .stream()
                    .filter(active -> prevId == null || !active.getId().equals(prevId))
                    .anyMatch(active -> active.getStartDate() != null && active.getEndDate() != null
                            && !active.getStartDate().isAfter(endDate)
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
        subscription.setStatus(ACTIVE);
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
