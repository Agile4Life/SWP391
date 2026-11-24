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
 * Lịch sử các yêu cầu gói tập (đăng ký, gia hạn, nâng cấp) mà quầy đã xử lý: các yêu cầu đã thanh toán và kích hoạt,
 * cùng các yêu cầu đã rút trước khi thanh toán. Hàng chờ xử lý chỉ liệt kê các yêu cầu đang mở, nên không có màn này
 * quầy sẽ không thể tra cứu lại những gì đã duyệt.
 */
@Service
public class MembershipRequestHistoryService {
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> SETTLED = List.of("success", "refunded");

    private final PaymentRepository payments;
    private final MembershipSubscriptionRepository subscriptions;
    private final Clock clock;

    /** Nhận repository thanh toán, repository gói và Clock. */
    public MembershipRequestHistoryService(PaymentRepository payments, MembershipSubscriptionRepository subscriptions,
                                           Clock clock) {
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.clock = clock;
    }

    /**
     * Gom các kỳ có thanh toán thành công trong khoảng ngày (APPROVED) và các kỳ bị hủy mà chưa từng thanh toán
     * (CANCELLED), mới nhất trước. Kỳ đã thanh toán rồi mới hủy thuộc luồng hủy/hoàn tiền nên bỏ qua.
     */
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
            // Kỳ đã thanh toán rồi bị hủy về sau thuộc luồng hủy/hoàn tiền, không thuộc lịch sử yêu cầu này.
            boolean wasPaid = payments.findAllBySubscriptionId(sub.getId()).stream()
                    .anyMatch(p -> SETTLED.contains(p.getStatus()));
            if (wasPaid) continue;
            rows.add(row(sub, "CANCELLED", sub.getQuotedPrice(), null, sub.getUpdatedAt(), null));
        }
        rows.sort(Comparator.comparing(RequestHistoryDto::processedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return rows;
    }

    /** Bỏ hội viên đã bị xóa. */
    private static boolean visible(MembershipSubscription sub) {
        return sub.getMember() != null && sub.getMember().getUser() != null && sub.getMember().getUser().getDeletedAt() == null;
    }

    /** Loại yêu cầu: không có kỳ trước là REGISTER; khác gói hoặc có phí nâng cấp là UPGRADE; còn lại là RENEW. */
    static String typeOf(MembershipSubscription sub) {
        MembershipSubscription previous = sub.getPreviousSubscription();
        if (previous == null) return "REGISTER";
        boolean otherPackage = previous.getMembershipPackage() != null && sub.getMembershipPackage() != null
                && !previous.getMembershipPackage().getId().equals(sub.getMembershipPackage().getId());
        return otherPackage || sub.getUpgradeCharge() != null ? "UPGRADE" : "RENEW";
    }

    /** Tạo một dòng lịch sử từ kỳ gói và kết quả. */
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
