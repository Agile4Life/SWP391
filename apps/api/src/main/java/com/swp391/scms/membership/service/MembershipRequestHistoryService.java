package com.swp391.scms.membership.service;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.dto.SubscriptionResponses.RequestHistoryDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * History of the membership requests (register, renew, upgrade) the desk has processed: the ones paid and activated,
 * and the ones withdrawn before payment. The pending queue only lists open requests, so without this the desk could
 * not look back at what it approved.
 */
@Service
public class MembershipRequestHistoryService {
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> SETTLED = List.of("success", "refunded");

    private final PaymentRepository payments;
    private final MembershipSubscriptionRepository subscriptions;
    private final Clock clock;

    public MembershipRequestHistoryService(PaymentRepository payments, MembershipSubscriptionRepository subscriptions,
                                           Clock clock) {
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RequestHistoryDto> history(Integer days) {
        int window = days == null ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, days));
        LocalDateTime since = LocalDateTime.now(clock).minusDays(window);
        List<RequestHistoryDto> rows = new ArrayList<>();
        Set<Long> settled = new HashSet<>();
        for (Payment payment : payments.findBySubscriptionIdIsNotNullAndStatusInAndPaidAtGreaterThanEqualOrderByPaidAtDesc(SETTLED, since)) {
            MembershipSubscription sub = payment.getSubscription();
            if (sub == null || !visible(sub) || !settled.add(sub.getId())) continue;
            rows.add(row(sub, "APPROVED", payment.getAmount(), payment.getMethod(), payment.getPaidAt(),
                    payment.getReceivedBy() == null ? null : payment.getReceivedBy().getFullName()));
        }
        for (MembershipSubscription sub : subscriptions.findByStatusAndUpdatedAtGreaterThanEqualOrderByUpdatedAtDesc("cancelled", since)) {
            if (settled.contains(sub.getId()) || !visible(sub)) continue;
            // A paid period cancelled later belongs to the cancellation/refund flow, not to this request history.
            boolean wasPaid = payments.findAllBySubscriptionId(sub.getId()).stream()
                    .anyMatch(p -> SETTLED.contains(p.getStatus()));
            if (wasPaid) continue;
            rows.add(row(sub, "CANCELLED", sub.getQuotedPrice(), null, sub.getUpdatedAt(), null));
        }
        rows.sort(Comparator.comparing(RequestHistoryDto::processedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return rows;
    }

    private static boolean visible(MembershipSubscription sub) {
        return sub.getMember() != null && sub.getMember().getUser() != null && sub.getMember().getUser().getDeletedAt() == null;
    }

    static String typeOf(MembershipSubscription sub) {
        MembershipSubscription previous = sub.getPreviousSubscription();
        if (previous == null) return "REGISTER";
        boolean otherPackage = previous.getMembershipPackage() != null && sub.getMembershipPackage() != null
                && !previous.getMembershipPackage().getId().equals(sub.getMembershipPackage().getId());
        return otherPackage || sub.getUpgradeCharge() != null ? "UPGRADE" : "RENEW";
    }

    private static RequestHistoryDto row(MembershipSubscription sub, String outcome, BigDecimal amount,
                                         String method, LocalDateTime at, String by) {
        var member = sub.getMember();
        var previous = sub.getPreviousSubscription();
        return new RequestHistoryDto(sub.getId(), typeOf(sub), outcome, member.getUserId(), member.getMembershipCode(),
                member.getUser().getFullName(),
                sub.getMembershipPackage() == null ? null : sub.getMembershipPackage().getName(),
                previous == null || previous.getMembershipPackage() == null ? null : previous.getMembershipPackage().getName(),
                amount, method, at, by);
    }
}
