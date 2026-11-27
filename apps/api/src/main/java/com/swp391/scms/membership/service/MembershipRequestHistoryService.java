package com.swp391.scms.membership.service;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import com.swp391.scms.wallet.WalletTransactionRepository;
import com.swp391.scms.membership.dto.SubscriptionResponses.RequestHistoryDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;
import java.util.stream.Collectors;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.wallet.WalletTransaction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lịch sử các yêu cầu gói tập (đăng ký, gia hạn, nâng cấp) mà quầy đã xử lý: các yêu cầu đã thanh toán và kích hoạt,
 * cùng các yêu cầu đã rút trước khi thanh toán. Hàng chờ xử lý chỉ liệt kê các yêu cầu đang mở, nên không có màn này
 * quầy sẽ không thể tra cứu lại những gì đã duyệt.
 */
@Service
public class MembershipRequestHistoryService {
    public static final int ALL_TIME_DAYS = 0;
    public static final int TODAY_DAYS = 1;
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> SETTLED = List.of("success", "refunded");
    private static final int PAYMENT_LOOKUP_BATCH_SIZE = 500;

    private final PaymentRepository payments;
    private final MembershipSubscriptionRepository subscriptions;
    private final Clock clock;
    private final VnpayTransactionRepository attempts;
    private final WalletTransactionRepository ledger;

    /** Nhận repository thanh toán, repository gói và Clock. */
    public MembershipRequestHistoryService(PaymentRepository payments, MembershipSubscriptionRepository subscriptions,
                                           Clock clock) {
        this(payments, subscriptions, clock, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public MembershipRequestHistoryService(PaymentRepository payments, MembershipSubscriptionRepository subscriptions,
            Clock clock, VnpayTransactionRepository attempts, WalletTransactionRepository ledger) {
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.clock = clock;
        this.attempts = attempts;
        this.ledger = ledger;
    }

    /**
     * Gom các kỳ có thanh toán thành công trong khoảng ngày (APPROVED) và các kỳ bị hủy mà chưa từng thanh toán
     * (CANCELLED), mới nhất trước. Dòng APPROVED giữ thông tin khoản thu đã chọn, kể cả khi khoản thu có hoàn;
     * không khẳng định quyền lợi gói hiện còn kích hoạt. Không cộng gộp các payment của cùng kỳ.
     */
    @Transactional(readOnly = true)
    public List<RequestHistoryDto> history(Integer days) {
        boolean allTime = days != null && days == ALL_TIME_DAYS;
        boolean todayOnly = days != null && days == TODAY_DAYS;
        int window = days == null ? DEFAULT_DAYS : Math.max(TODAY_DAYS, Math.min(MAX_DAYS, days));
        // ALL_TIME_DAYS (0) là toàn bộ lịch sử; TODAY_DAYS (1) bắt đầu lúc 00:00 theo Clock giờ trung tâm.
        LocalDateTime since = todayOnly ? LocalDate.now(clock).atStartOfDay() : LocalDateTime.now(clock).minusDays(window);
        List<RequestHistoryDto> rows = new ArrayList<>();
        Set<Long> settled = new HashSet<>();
        List<Payment> settledPayments = allTime
                ? payments.findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(SETTLED)
                : payments.findBySubscriptionIdIsNotNullAndStatusInAndPaidAtGreaterThanEqualOrderByPaidAtDesc(SETTLED, since);
        List<MembershipSubscription> cancelledSubs = allTime
                ? subscriptions.findByStatusOrderByUpdatedAtDesc("cancelled")
                : subscriptions.findByStatusAndUpdatedAtGreaterThanEqualOrderByUpdatedAtDesc("cancelled", since);
        Set<Long> paidSubscriptionIds = settledPayments.stream().filter(p -> p.getSubscription() != null)
                .map(p -> p.getSubscription().getId()).collect(Collectors.toSet());
        Map<Long, List<Payment>> unpaidPayments = new HashMap<>();
        List<Payment> evidencePayments = new ArrayList<>(settledPayments);
        // Gom ID trước khi đọc Payment; loại ID trùng và chia lô để giới hạn tham số IN.
        List<Long> lookupIds = cancelledSubs.stream()
                .filter(sub -> !paidSubscriptionIds.contains(sub.getId()) && visible(sub))
                .map(MembershipSubscription::getId).filter(Objects::nonNull).distinct().toList();
        Map<Long, List<Payment>> linkedPayments = new HashMap<>();
        for (int offset = 0; offset < lookupIds.size(); offset += PAYMENT_LOOKUP_BATCH_SIZE) {
            for (var payment : payments.findAllBySubscriptionIdIn(
                    lookupIds.subList(offset, Math.min(offset + PAYMENT_LOOKUP_BATCH_SIZE, lookupIds.size())))) {
                linkedPayments.computeIfAbsent(payment.getSubscriptionId(), id -> new ArrayList<>()).add(payment);
            }
        }
        for (var sub : cancelledSubs) {
            if (paidSubscriptionIds.contains(sub.getId()) || !visible(sub)) continue;
            var linked = linkedPayments.getOrDefault(sub.getId(), List.of());
            if (linked.stream().anyMatch(p -> SETTLED.contains(p.getStatus()))) continue;
            unpaidPayments.put(sub.getId(), linked);
            evidencePayments.addAll(linked);
        }
        List<Long> paymentIds = evidencePayments.stream().map(Payment::getId).filter(Objects::nonNull).distinct().toList();
        List<VnpayTransaction> paymentAttempts = attempts == null || paymentIds.isEmpty() ? List.of()
                : attempts.findAllByPaymentIdIn(paymentIds);
        var byPayment = paymentAttempts.stream().filter(t -> t.getPayment() != null)
                .collect(Collectors.groupingBy(t -> t.getPayment().getId()));
        Set<String> references = new HashSet<>();
        paymentIds.forEach(id -> references.add("WALLET_PAY_" + id));
        paymentAttempts.forEach(t -> {
            references.add(t.getReference() + ":TOPUP");
            references.add(t.getReference() + ":DEBIT");
            references.add(t.getReference() + ":LATE_REFUND");
        });
        // Đọc theo lô bằng index reference_id; không nạp toàn bộ ledger hay truy vấn riêng cho từng dòng.
        Map<String, List<WalletTransaction>> byReference = ledger == null || references.isEmpty() ? Map.of()
                : ledger.findByReferenceIdIn(references).stream().collect(Collectors.groupingBy(WalletTransaction::getReferenceId));
        for (Payment payment : settledPayments) {
            MembershipSubscription sub = payment.getSubscription();
            if (sub == null || !visible(sub) || !settled.add(sub.getId())) continue;
            var related = byPayment.getOrDefault(payment.getId(), List.of());
            boolean sameMember = payment.getMember() != null
                    && Objects.equals(payment.getMember().getUserId(), sub.getMember().getUserId());
            rows.add(row(sub, "APPROVED", payment, sameMember ? source(payment, related, byReference) : "UNKNOWN",
                    sameMember ? lateRefund(payment, related, byReference) : null));
        }
        for (MembershipSubscription sub : cancelledSubs) {
            if (!unpaidPayments.containsKey(sub.getId())) continue;
            // Chưa thu cho yêu cầu vẫn có thể đã hoàn lượt cổng đến muộn; báo riêng khoản hoàn có bằng chứng.
            BigDecimal returned = BigDecimal.ZERO;
            for (var payment : unpaidPayments.get(sub.getId())) {
                if (payment.getMember() == null || !Objects.equals(payment.getMember().getUserId(), sub.getMember().getUserId())) {
                    returned = null;
                    break;
                }
                var refund = lateRefund(payment, byPayment.getOrDefault(payment.getId(), List.of()), byReference);
                if (refund == null) { returned = null; break; }
                returned = returned.add(refund);
            }
            rows.add(row(sub, "CANCELLED", null, "UNPAID", returned));
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
    private static RequestHistoryDto row(MembershipSubscription sub, String outcome, Payment payment,
                                         String actualMethod, BigDecimal lateRefund) {
        var member = sub.getMember();
        var previous = sub.getPreviousSubscription();
        BigDecimal paid = payment == null ? BigDecimal.ZERO : payment.getAmount();
        BigDecimal quote = sub.getUpgradeCharge() != null ? sub.getUpgradeCharge() : sub.getQuotedPrice();
        BigDecimal refunded = payment == null ? BigDecimal.ZERO : payment.getRefundedAmount();
        // Không đoán số tiền hoàn của dữ liệu cũ; số âm/vượt khoản thu hoặc trạng thái mâu thuẫn là chưa xác định.
        if (refunded != null && (paid == null || refunded.signum() < 0 || refunded.compareTo(paid) > 0
                || (payment != null && "refunded".equals(payment.getStatus()) && refunded.compareTo(paid) != 0))) refunded = null;
        return new RequestHistoryDto(sub.getId(), typeOf(sub), outcome, member.getUserId(), member.getMembershipCode(),
                member.getUser().getFullName(),
                sub.getMembershipPackage() == null ? null : sub.getMembershipPackage().getName(),
                previous == null || previous.getMembershipPackage() == null ? null : previous.getMembershipPackage().getName(),
                paid, payment == null ? null : payment.getMethod(), payment == null ? sub.getUpdatedAt() : payment.getPaidAt(),
                payment == null || payment.getReceivedBy() == null ? null : payment.getReceivedBy().getFullName(),
                payment == null ? null : payment.getId(), payment == null ? null : payment.getStatus(), actualMethod,
                paid, quote, refunded, lateRefund);
    }

    /** Chỉ dùng bằng chứng khớp payment, hội viên, số tiền và trạng thái đã settle. */
    private static String source(Payment payment, List<VnpayTransaction> attempts, Map<String, List<WalletTransaction>> ledger) {
        if (!SETTLED.contains(payment.getStatus()) || payment.getPaidAt() == null || payment.getAmount() == null) return "UNKNOWN";
        String direct = switch (payment.getMethod() == null ? "" : payment.getMethod()) {
            case "cash" -> "CASH";
            case "pos" -> "POS";
            case "bank_transfer" -> "BANK_TRANSFER";
            default -> null;
        };
        String walletRef = "WALLET_PAY_" + payment.getId();
        boolean wallet = matching(payment, ledger, walletRef, "PAYMENT_DEBIT", "WALLET_PAYMENT", payment.getAmount()) == 1;
        if (!ledger.getOrDefault(walletRef, List.of()).isEmpty() && !wallet) return "UNKNOWN";
        int gateway = 0;
        for (var attempt : attempts) {
            String ref = attempt.getReference();
            if (ledger.getOrDefault(ref + ":TOPUP", List.of()).isEmpty()
                    && ledger.getOrDefault(ref + ":DEBIT", List.of()).isEmpty()) continue;
            if (!"success".equals(attempt.getStatus()) || attempt.getGatewayTransactionNo() == null
                    || !attempt.getGatewayTransactionNo().matches("[0-9]*[1-9][0-9]*")
                    || !sameAmount(attempt.getAmount(), payment.getAmount())
                    || !ledger.getOrDefault(ref + ":LATE_REFUND", List.of()).isEmpty()
                    || matching(payment, ledger, ref + ":TOPUP", "TOPUP_VNPAY", "VNPAY", attempt.getAmount()) != 1
                    || matching(payment, ledger, ref + ":DEBIT", "PAYMENT_DEBIT", "VNPAY", attempt.getAmount()) != 1) return "UNKNOWN";
            gateway++;
        }
        // Ledger VNPay là một nguồn VNPay, không phải thanh toán chia nguồn với số dư ví.
        if ((direct == null ? 0 : 1) + (wallet ? 1 : 0) + gateway != 1) return "UNKNOWN";
        return direct != null ? direct : wallet ? "WALLET" : "VNPAY";
    }

    /** Hoàn lượt cổng đến muộn là khoản riêng, không trừ vào tiền đã thu của payment gốc. */
    private static BigDecimal lateRefund(Payment payment, List<VnpayTransaction> attempts, Map<String, List<WalletTransaction>> ledger) {
        BigDecimal total = BigDecimal.ZERO;
        for (var attempt : attempts) {
            String ref = attempt.getReference() + ":LATE_REFUND";
            var recorded = ledger.getOrDefault(ref, List.of());
            if (recorded.isEmpty()) continue;
            if (!"success".equals(attempt.getStatus()) || recorded.size() != 1
                    || matching(payment, ledger, ref, "REFUND_CREDIT", "VNPAY_LATE_REFUND", attempt.getAmount()) != 1) return null;
            total = total.add(recorded.getFirst().getAmount());
        }
        return total;
    }

    private static List<WalletTransaction> owned(Payment payment, Map<String, List<WalletTransaction>> ledger, String ref) {
        if (payment.getMember() == null || payment.getMember().getUserId() == null) return List.of();
        return ledger.getOrDefault(ref, List.of()).stream().filter(e -> e.getWallet() != null && e.getWallet().getUser() != null
                && payment.getMember().getUserId().equals(e.getWallet().getUser().getId())).toList();
    }

    private static long matching(Payment payment, Map<String, List<WalletTransaction>> ledger, String ref,
                                 String type, String referenceType, BigDecimal amount) {
        // Reference không có unique constraint: bản ghi trùng hoặc mâu thuẫn không đủ làm bằng chứng.
        if (ledger.getOrDefault(ref, List.of()).size() != 1) return 0;
        return owned(payment, ledger, ref).stream().filter(e -> type.equals(e.getType()) && referenceType.equals(e.getReferenceType())
                && amount != null && amount.signum() > 0 && sameAmount(e.getAmount(), amount)).count();
    }

    private static boolean sameAmount(BigDecimal first, BigDecimal second) {
        return first != null && second != null && first.compareTo(second) == 0;
    }
}
