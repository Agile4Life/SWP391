package com.swp391.scms.wallet;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.MemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Records a front-desk wallet top-up as a settled payment, so it shows up in the member's "Giao dịch & hóa đơn" like a
 * VNPay top-up does, and lets the desk look back at the top-ups it took.
 */
@Service
public class CounterTopupService {
    public static final String NOTE_PREFIX = "WALLET_TOPUP";
    public static final String COUNTER_NOTE = NOTE_PREFIX + ":COUNTER";
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> COUNTER_METHODS = List.of("cash", "pos", "bank_transfer");

    public record TopupHistoryDto(
            Long paymentId,
            Long memberId,
            String membershipCode,
            String memberName,
            BigDecimal amount,
            String paymentMethod,
            LocalDateTime paidAt,
            String receivedByName) {}

    private final PaymentRepository payments;
    private final MemberRepository members;
    private final UserRepository users;
    private final InvoiceService invoices;
    private final Clock clock;

    public CounterTopupService(PaymentRepository payments, MemberRepository members, UserRepository users,
                               InvoiceService invoices, Clock clock) {
        this.payments = payments;
        this.members = members;
        this.users = users;
        this.invoices = invoices;
        this.clock = clock;
    }

    /** Maps the desk's method code onto the payment methods the table allows; anything unknown is cash. */
    static String normalizeMethod(String method) {
        String value = method == null ? "cash" : method.trim().toLowerCase(Locale.ROOT);
        return COUNTER_METHODS.contains(value) ? value : "cash";
    }

    @Transactional
    public void record(Long memberId, BigDecimal amount, String paymentMethod, Long staffUserId) {
        Member member = members.findById(memberId).orElse(null);
        if (member == null) return;
        Payment payment = new Payment();
        payment.setMember(member);
        payment.setAmount(amount);
        payment.setMethod(normalizeMethod(paymentMethod));
        payment.setStatus("success");
        payment.setNote(COUNTER_NOTE);
        payment.setPaidAt(LocalDateTime.now(clock));
        if (staffUserId != null) {
            users.findByIdAndDeletedAtIsNull(staffUserId).ifPresent(payment::setReceivedBy);
        }
        payment = payments.save(payment);
        try {
            invoices.autoIssueInvoiceForPayment(payment.getId());
        } catch (RuntimeException ignored) {
            // The invoice is best effort; the top-up itself is already recorded.
        }
    }

    @Transactional(readOnly = true)
    public List<TopupHistoryDto> history(Integer days) {
        int window = days == null ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, days));
        LocalDateTime since = LocalDateTime.now(clock).minusDays(window);
        return payments.findByNoteAndStatusAndPaidAtGreaterThanEqualOrderByPaidAtDesc(COUNTER_NOTE, "success", since)
                .stream()
                .filter(p -> p.getMember() != null && p.getMember().getUser() != null
                        && p.getMember().getUser().getDeletedAt() == null)
                .map(p -> new TopupHistoryDto(
                        p.getId(),
                        p.getMember().getUserId(),
                        p.getMember().getMembershipCode(),
                        p.getMember().getUser().getFullName(),
                        p.getAmount(),
                        p.getMethod(),
                        p.getPaidAt(),
                        p.getReceivedBy() == null ? null : p.getReceivedBy().getFullName()))
                .toList();
    }
}
