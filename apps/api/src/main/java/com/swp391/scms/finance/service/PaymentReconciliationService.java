package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.finance.dto.ReconciliationDtos.*;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.entity.VnpayIpnEvent;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayIpnEventRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.wallet.WalletTransaction;
import com.swp391.scms.wallet.WalletTransactionRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read-only view of VNPay attempts, callbacks and the automatic late refunds for administrators. Nothing here changes
 * money or payment state; every change still goes through the existing payment flows.
 */
@Service
@Transactional(readOnly = true)
public class PaymentReconciliationService {
    public static final int DEFAULT_RANGE_DAYS = 7;
    public static final int MAX_RANGE_DAYS = 92;
    public static final int MAX_PAGE_SIZE = 100;
    static final String LATE_REFUND_SUFFIX = ":LATE_REFUND";
    static final String ORDER_LATE_REFUND_PREFIX = "ORDER_LATE_REFUND_";
    private static final Set<String> STATUSES = Set.of("pending", "success", "failed");
    private static final Set<String> SOURCES = Set.of(VnpayIpnEvent.SOURCE_IPN, VnpayIpnEvent.SOURCE_RETURN);

    private final VnpayTransactionRepository attempts;
    private final VnpayIpnEventRepository callbacks;
    private final PaymentRepository payments;
    private final WalletTransactionRepository walletTransactions;
    private final Clock clock;

    public PaymentReconciliationService(VnpayTransactionRepository attempts, VnpayIpnEventRepository callbacks,
                                        PaymentRepository payments, WalletTransactionRepository walletTransactions,
                                        Clock clock) {
        this.attempts = attempts;
        this.callbacks = callbacks;
        this.payments = payments;
        this.walletTransactions = walletTransactions;
        this.clock = clock;
    }

    /** Inclusive date range resolved against the default and maximum window. */
    public record DateRange(LocalDate from, LocalDate to) {
        public LocalDateTime start() { return from.atStartOfDay(); }
        public LocalDateTime endExclusive() { return to.plusDays(1).atStartOfDay(); }
    }

    public DateRange range(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : (from != null ? from.plusDays(DEFAULT_RANGE_DAYS - 1L) : today());
        LocalDate start = from != null ? from : end.minusDays(DEFAULT_RANGE_DAYS - 1L);
        if (start.isAfter(end)) {
            throw new BadRequestException("RECONCILIATION_RANGE_INVALID", "error.reconciliation.range_invalid", null,
                    "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_RANGE_DAYS) {
            throw new BadRequestException("RECONCILIATION_RANGE_TOO_LONG", "error.reconciliation.range_too_long",
                    new Object[]{MAX_RANGE_DAYS}, "Khoảng thời gian tra cứu tối đa " + MAX_RANGE_DAYS + " ngày.");
        }
        return new DateRange(start, end);
    }

    public Pageable page(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new BadRequestException("RECONCILIATION_PAGE_INVALID", "error.reconciliation.page_invalid",
                    new Object[]{MAX_PAGE_SIZE}, "Trang phải từ 0 và kích thước trang từ 1 đến " + MAX_PAGE_SIZE + ".");
        }
        return PageRequest.of(page, size, sort);
    }

    public ReconciliationSummaryDto summary(LocalDate from, LocalDate to) {
        DateRange r = range(from, to);
        LocalDateTime cutoff = staleCutoff();
        long successUnpaid = attempts.countSuccessAttemptsOnUnpaidPayments();
        long withoutSource = payments.countOnlinePaymentsWithoutSource();
        BigDecimal refunded = walletTransactions.sumLateRefunds(r.start(), r.endExclusive());
        return new ReconciliationSummaryDto(
                r.from(), r.to(),
                attempts.countByStatusAndExpiresAtBefore("pending", cutoff),
                attempts.countByStatusAndExpiresAtGreaterThanEqual("pending", cutoff),
                walletTransactions.countLateRefunds(r.start(), r.endExclusive()),
                refunded != null ? refunded : BigDecimal.ZERO,
                callbacks.countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(List.of("99"), r.start(), r.endExclusive()),
                callbacks.countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(List.of("97", "04", "01"), r.start(), r.endExclusive()),
                attempts.countMultiAttemptPayments(r.start(), r.endExclusive()),
                new AnomalyCounts(successUnpaid, withoutSource, successUnpaid + withoutSource));
    }

    public Page<VnpayAttemptRowDto> attempts(String status, Boolean stale, String q, LocalDate from, LocalDate to,
                                             int page, int size) {
        Pageable pageable = page(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("reference")));
        LocalDateTime cutoff = staleCutoff();
        String normalizedStatus = blankToNull(status);
        if (normalizedStatus != null) {
            normalizedStatus = normalizedStatus.toLowerCase(Locale.ROOT);
            if (!STATUSES.contains(normalizedStatus)) throw invalidFilter("status");
        }
        boolean onlyStale = Boolean.TRUE.equals(stale);
        // "Stale" is the current state of the queue, so it is not limited to the date range.
        DateRange r = onlyStale ? null : range(from, to);
        Specification<VnpayTransaction> spec = attemptSpec(normalizedStatus, onlyStale, blankToNull(q), r, cutoff);
        Page<VnpayTransaction> result = attempts.findAll(spec, pageable);
        Map<Long, Long> counts = attemptCounts(result.getContent());
        return result.map(t -> attemptRow(t, counts.getOrDefault(paymentId(t), 1L), cutoff));
    }

    public Page<LateRefundRowDto> lateRefunds(LocalDate from, LocalDate to, int page, int size) {
        Pageable pageable = page(page, size, Sort.unsorted());
        DateRange r = range(from, to);
        Page<WalletTransaction> result = walletTransactions.findLateRefunds(r.start(), r.endExclusive(), pageable);
        Set<String> refs = result.getContent().stream().map(w -> gatewayReference(w.getReferenceId()))
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, VnpayTransaction> byRef = refs.isEmpty() ? Map.of()
                : attempts.findAllByReferenceIn(refs).stream()
                .collect(Collectors.toMap(VnpayTransaction::getReference, Function.identity(), (a, b) -> a));
        return result.map(w -> {
            String ref = gatewayReference(w.getReferenceId());
            VnpayTransaction t = ref != null ? byRef.get(ref) : null;
            Payment p = t != null ? t.getPayment() : null;
            User user = w.getWallet() != null ? w.getWallet().getUser() : null;
            return new LateRefundRowDto(w.getId(), w.getCreatedAt(), member(user), w.getAmount(),
                    w.getReferenceId() != null && w.getReferenceId().startsWith(ORDER_LATE_REFUND_PREFIX)
                            ? "ORDER_LATE_REFUND" : "VNPAY_LATE_REFUND",
                    ref, p != null ? p.getId() : null, p != null ? p.getStatus() : null);
        });
    }

    public Page<IpnEventRowDto> ipnEvents(String rspCode, String source, String reference, LocalDate from, LocalDate to,
                                          int page, int size) {
        Pageable pageable = page(page, size, Sort.by(Sort.Direction.DESC, "receivedAt").and(Sort.by(Sort.Direction.DESC, "id")));
        DateRange r = range(from, to);
        String code = blankToNull(rspCode);
        if (code != null && !code.matches("[0-9]{2}")) throw invalidFilter("rspCode");
        String src = blankToNull(source);
        if (src != null) {
            src = src.toUpperCase(Locale.ROOT);
            if (!SOURCES.contains(src)) throw invalidFilter("source");
        }
        String ref = blankToNull(reference);
        final String fCode = code, fSrc = src;
        Specification<VnpayIpnEvent> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.greaterThanOrEqualTo(root.get("receivedAt"), r.start()));
            ps.add(cb.lessThan(root.get("receivedAt"), r.endExclusive()));
            if (fCode != null) ps.add(cb.equal(root.get("rspCode"), fCode));
            if (fSrc != null) ps.add(cb.equal(root.get("source"), fSrc));
            if (ref != null) ps.add(cb.equal(root.get("reference"), ref));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return callbacks.findAll(spec, pageable).map(PaymentReconciliationService::eventRow);
    }

    public PaymentTimelineDto timeline(Long paymentId) {
        Payment p = paymentId == null ? null : payments.findById(paymentId).orElse(null);
        if (p == null) {
            throw new ResourceNotFoundException("PAYMENT_NOT_FOUND", "error.reconciliation.payment_not_found",
                    new Object[]{paymentId}, "Không tìm thấy khoản thanh toán #" + paymentId + ".");
        }
        LocalDateTime cutoff = staleCutoff();
        List<VnpayTransaction> list = new ArrayList<>(Optional.ofNullable(attempts.findAllByPaymentId(p.getId())).orElse(List.of()));
        list.sort(Comparator.comparing(VnpayTransaction::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));
        List<String> refs = list.stream().map(VnpayTransaction::getReference).toList();
        List<VnpayIpnEvent> events = refs.isEmpty() ? List.of()
                : Optional.ofNullable(callbacks.findAllByReferenceInOrderByReceivedAtAscIdAsc(refs)).orElse(List.of());
        List<String> walletRefs = new ArrayList<>();
        walletRefs.add("WALLET_PAY_" + p.getId());
        for (String ref : refs) {
            walletRefs.add(ref + ":TOPUP");
            walletRefs.add(ref + ":DEBIT");
            walletRefs.add(ref + LATE_REFUND_SUFFIX);
            walletRefs.add(ORDER_LATE_REFUND_PREFIX + ref);
        }
        List<WalletTransaction> wallet = Optional.ofNullable(
                walletTransactions.findAllByReferenceIdInOrderByCreatedAtAscIdAsc(walletRefs)).orElse(List.of());

        List<VnpayAttemptRowDto> attemptRows = list.stream().map(t -> attemptRow(t, list.size(), cutoff)).toList();
        List<IpnEventRowDto> eventRows = events.stream().map(PaymentReconciliationService::eventRow).toList();
        List<WalletEntryDto> walletRows = wallet.stream().map(w -> new WalletEntryDto(w.getId(), w.getType(),
                w.getReferenceType(), w.getReferenceId(), w.getAmount(), w.getCreatedAt())).toList();

        List<TimelineEntryDto> entries = new ArrayList<>();
        entries.add(new TimelineEntryDto(p.getCreatedAt(), "PAYMENT_CREATED", null, p.getStatus(), null, null, p.getAmount(), p.getMethod()));
        for (VnpayTransaction t : list) {
            entries.add(new TimelineEntryDto(t.getCreatedAt(), "ATTEMPT_CREATED", t.getReference(), t.getStatus(),
                    t.getGatewayTransactionNo(), null, t.getAmount(), null));
        }
        for (VnpayIpnEvent e : events) {
            entries.add(new TimelineEntryDto(e.getReceivedAt(), "CALLBACK_RECEIVED", e.getReference(),
                    e.getGatewayResponseCode(), e.getRspCode(), e.getSource(), e.getAmount(), e.getGatewayTransactionNo()));
        }
        for (WalletTransaction w : wallet) {
            entries.add(new TimelineEntryDto(w.getCreatedAt(), "WALLET_TRANSACTION", w.getReferenceId(), w.getType(),
                    w.getReferenceType(), null, w.getAmount(), null));
        }
        if (p.getPaidAt() != null) {
            entries.add(new TimelineEntryDto(p.getPaidAt(), "PAYMENT_PAID", null, p.getStatus(), null, null, p.getAmount(), p.getMethod()));
        }
        String invoiceNumber = null;
        if (p.getInvoice() != null) {
            invoiceNumber = p.getInvoice().getInvoiceNumber();
            entries.add(new TimelineEntryDto(p.getInvoice().getIssuedAt(), "INVOICE_ISSUED", null, null, null, null,
                    p.getInvoice().getTotalAmount(), invoiceNumber));
        }
        entries.sort(Comparator.comparing(TimelineEntryDto::at, Comparator.nullsLast(Comparator.naturalOrder())));

        String[] target = target(p);
        PaymentInfoDto info = new PaymentInfoDto(p.getId(), member(p.getMember() != null ? p.getMember().getUser() : null),
                p.getAmount(), p.getRefundedAmount(), p.getMethod(), p.getStatus(), target[0],
                target[1] != null ? Long.valueOf(target[1]) : null, p.getCreatedAt(), p.getPaidAt(), invoiceNumber);
        return new PaymentTimelineDto(info, attemptRows, eventRows, walletRows, entries);
    }

    // --- helpers ---

    private Specification<VnpayTransaction> attemptSpec(String status, boolean onlyStale, String q, DateRange r,
                                                        LocalDateTime cutoff) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            Join<Object, Object> payment = root.join("payment", JoinType.INNER);
            Join<Object, Object> user = payment.join("member", JoinType.LEFT).join("user", JoinType.LEFT);
            if (onlyStale) {
                ps.add(cb.equal(root.get("status"), "pending"));
                ps.add(cb.lessThan(root.get("expiresAt"), cutoff));
            } else if (status != null) {
                ps.add(cb.equal(root.get("status"), status));
            }
            if (r != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("createdAt"), r.start()));
                ps.add(cb.lessThan(root.get("createdAt"), r.endExclusive()));
            }
            if (q != null) {
                String like = "%" + q.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                ps.add(cb.or(
                        cb.equal(root.get("reference"), q),
                        cb.like(cb.lower(user.get("email")), like, '!'),
                        cb.like(user.get("phone"), like, '!')));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private Map<Long, Long> attemptCounts(List<VnpayTransaction> rows) {
        Set<Long> ids = rows.stream().map(PaymentReconciliationService::paymentId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        Map<Long, Long> counts = new HashMap<>();
        List<Object[]> raw = attempts.countAttemptsByPaymentIds(ids);
        if (raw != null) {
            for (Object[] row : raw) counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private VnpayAttemptRowDto attemptRow(VnpayTransaction t, long attemptCount, LocalDateTime cutoff) {
        Payment p = t.getPayment();
        String[] target = target(p);
        boolean stale = "pending".equals(t.getStatus()) && t.getExpiresAt() != null && t.getExpiresAt().isBefore(cutoff);
        return new VnpayAttemptRowDto(t.getReference(), p != null ? p.getId() : null,
                member(p != null && p.getMember() != null ? p.getMember().getUser() : null),
                t.getAmount(), t.getStatus(), stale, p != null ? p.getStatus() : null,
                target[0], target[1] != null ? Long.valueOf(target[1]) : null,
                t.getCreatedAt(), t.getExpiresAt(), t.getGatewayTransactionNo(), attemptCount);
    }

    private static IpnEventRowDto eventRow(VnpayIpnEvent e) {
        return new IpnEventRowDto(e.getId(), e.getReference(), e.getSource(), e.getGatewayResponseCode(),
                e.getGatewayTransactionStatus(), e.getGatewayTransactionNo(), e.getAmount(), e.getRspCode(), e.getReceivedAt());
    }

    /** What the payment is for, with the same fallback as the gateway checkout: no linked record means a top-up. */
    static String[] target(Payment p) {
        if (p == null) return new String[]{null, null};
        if (p.getSubscriptionId() != null) return new String[]{"MEMBERSHIP", p.getSubscriptionId().toString()};
        if (p.getCoachBookingId() != null) return new String[]{"COACH_BOOKING", p.getCoachBookingId().toString()};
        if (p.getCourtBookingId() != null) return new String[]{"COURT_BOOKING", p.getCourtBookingId().toString()};
        if (p.getProductOrderId() != null) return new String[]{"PRODUCT_ORDER", p.getProductOrderId().toString()};
        if (p.getClassEnrollmentId() != null) return new String[]{"COURSE", p.getClassEnrollmentId().toString()};
        return new String[]{"WALLET_TOPUP", null};
    }

    /** Gateway reference from {@code <ref>:LATE_REFUND} or {@code ORDER_LATE_REFUND_<ref>}. */
    static String gatewayReference(String walletReferenceId) {
        if (walletReferenceId == null) return null;
        if (walletReferenceId.endsWith(LATE_REFUND_SUFFIX)) {
            return walletReferenceId.substring(0, walletReferenceId.length() - LATE_REFUND_SUFFIX.length());
        }
        if (walletReferenceId.startsWith(ORDER_LATE_REFUND_PREFIX)) {
            return walletReferenceId.substring(ORDER_LATE_REFUND_PREFIX.length());
        }
        return null;
    }

    private static MemberRef member(User u) {
        return u == null ? null : new MemberRef(u.getId(), u.getFullName(), u.getEmail(), u.getPhone());
    }

    private static Long paymentId(VnpayTransaction t) {
        return t.getPayment() != null ? t.getPayment().getId() : null;
    }

    private LocalDateTime staleCutoff() {
        return LocalDateTime.now(clock).minus(VnpayPaymentGuard.SETTLEMENT_GRACE);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static BadRequestException invalidFilter(String field) {
        return new BadRequestException("RECONCILIATION_FILTER_INVALID", "error.reconciliation.filter_invalid",
                new Object[]{field}, "Bộ lọc không hợp lệ: " + field + ".");
    }
}
