package com.swp391.scms.finance;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.entity.VnpayIpnEvent;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayIpnEventRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import com.swp391.scms.finance.service.PaymentReconciliationService;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.wallet.Wallet;
import com.swp391.scms.wallet.WalletTransaction;
import com.swp391.scms.wallet.WalletTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaymentReconciliationServiceTest {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 13, 10, 0);

    private VnpayTransactionRepository attempts;
    private VnpayIpnEventRepository callbacks;
    private PaymentRepository payments;
    private WalletTransactionRepository wallet;
    private PaymentReconciliationService service;

    @BeforeEach
    void setUp() {
        attempts = mock(VnpayTransactionRepository.class);
        callbacks = mock(VnpayIpnEventRepository.class);
        payments = mock(PaymentRepository.class);
        wallet = mock(WalletTransactionRepository.class);
        Clock clock = Clock.fixed(NOW.atZone(ZONE).toInstant(), ZONE);
        service = new PaymentReconciliationService(attempts, callbacks, payments, wallet, clock);
    }

    private static Payment payment(long id, String status) {
        User u = new User();
        u.setId(7L); u.setFullName("Nguyễn An"); u.setEmail("an@example.com"); u.setPhone("0900000000");
        Member m = new Member();
        m.setUserId(7L); m.setUser(u);
        Payment p = new Payment();
        p.setId(id); p.setMember(m); p.setAmount(new BigDecimal("150000")); p.setMethod("online_wallet");
        p.setStatus(status); p.setSubscriptionId(30L); p.setCreatedAt(NOW.minusHours(3));
        return p;
    }

    @Test
    void summaryCountsCurrentStateAndRange() {
        LocalDateTime start = LocalDate.of(2026, 11, 7).atStartOfDay();
        LocalDateTime end = LocalDate.of(2026, 11, 14).atStartOfDay();
        LocalDateTime cutoff = NOW.minusMinutes(15);
        when(attempts.countByStatusAndExpiresAtBefore("pending", cutoff)).thenReturn(2L);
        when(attempts.countByStatusAndExpiresAtGreaterThanEqual("pending", cutoff)).thenReturn(5L);
        when(wallet.countLateRefunds(start, end)).thenReturn(3L);
        when(wallet.sumLateRefunds(start, end)).thenReturn(new BigDecimal("450000"));
        when(callbacks.countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(List.of("99"), start, end)).thenReturn(4L);
        when(callbacks.countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(List.of("97", "04", "01"), start, end)).thenReturn(6L);
        when(attempts.countMultiAttemptPayments(start, end)).thenReturn(1L);
        when(attempts.countSuccessAttemptsOnUnpaidPayments()).thenReturn(1L);
        when(payments.countOnlinePaymentsWithoutSource()).thenReturn(2L);

        var s = service.summary(null, null);

        assertEquals(LocalDate.of(2026, 11, 7), s.from());
        assertEquals(LocalDate.of(2026, 11, 13), s.to());
        assertEquals(2, s.staleAttempts());
        assertEquals(5, s.pendingAttempts());
        assertEquals(3, s.lateRefundCount());
        assertEquals(0, new BigDecimal("450000").compareTo(s.lateRefundAmount()));
        assertEquals(4, s.ipnRetryable());
        assertEquals(6, s.ipnRejected());
        assertEquals(1, s.multiAttemptPayments());
        assertEquals(1, s.anomalies().successAttemptUnpaid());
        assertEquals(2, s.anomalies().walletPaymentWithoutSource());
        assertEquals(3, s.anomalies().total());
    }

    @Test
    void summaryWithNoDataIsZero() {
        when(wallet.sumLateRefunds(any(), any())).thenReturn(null);
        var s = service.summary(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 1));
        assertEquals(0, s.anomalies().total());
        assertEquals(BigDecimal.ZERO, s.lateRefundAmount());
    }

    @Test
    void rangeAndPageLimitsAreEnforced() {
        var tooLong = assertThrows(BadRequestException.class,
                () -> service.summary(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 11, 1)));
        assertEquals("RECONCILIATION_RANGE_TOO_LONG", tooLong.getErrorCode());
        assertEquals("RECONCILIATION_RANGE_INVALID", assertThrows(BadRequestException.class,
                () -> service.summary(LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 1))).getErrorCode());
        assertDoesNotThrow(() -> service.range(LocalDate.of(2026, 8, 14), LocalDate.of(2026, 11, 13)));
        assertThrows(BadRequestException.class, () -> service.range(LocalDate.of(2026, 8, 13), LocalDate.of(2026, 11, 13)));
        for (int[] bad : new int[][]{{-1, 20}, {0, 0}, {0, 101}}) {
            var e = assertThrows(BadRequestException.class, () -> service.lateRefunds(null, null, bad[0], bad[1]));
            assertEquals("RECONCILIATION_PAGE_INVALID", e.getErrorCode());
        }
        assertEquals("RECONCILIATION_FILTER_INVALID", assertThrows(BadRequestException.class,
                () -> service.attempts("paid", null, null, null, null, 0, 20)).getErrorCode());
        assertThrows(BadRequestException.class, () -> service.ipnEvents("x", null, null, null, null, 0, 20));
        assertThrows(BadRequestException.class, () -> service.ipnEvents(null, "WEB", null, null, null, 0, 20));
        verifyNoInteractions(attempts, callbacks);
    }

    @Test
    @SuppressWarnings("unchecked")
    void attemptsFlagStaleRowsAndCountAttemptsPerPayment() {
        Payment p = payment(11L, "pending");
        var stale = new VnpayTransaction("REF1", p, p.getAmount(), NOW.minusHours(1), NOW.minusMinutes(20), "127.0.0.1");
        var fresh = new VnpayTransaction("REF2", p, p.getAmount(), NOW.minusMinutes(5), NOW.plusMinutes(10), "127.0.0.1");
        when(attempts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(fresh, stale), PageRequest.of(0, 20), 2));
        when(attempts.countAttemptsByPaymentIds(anyCollection())).thenReturn(List.<Object[]>of(new Object[]{11L, 2L}));

        var page = service.attempts("pending", null, "an@", null, null, 0, 20);

        assertEquals(2, page.getTotalElements());
        var first = page.getContent().get(0);
        assertEquals("REF2", first.reference());
        assertFalse(first.stale());
        assertTrue(page.getContent().get(1).stale());
        assertEquals(2, first.attemptCount());
        assertEquals("MEMBERSHIP", first.targetType());
        assertEquals(30L, first.targetId());
        assertEquals("an@example.com", first.member().email());
    }

    @Test
    void lateRefundsResolveReferenceAndPayment() {
        Payment p = payment(11L, "success");
        var t = new VnpayTransaction("REFLATE", p, p.getAmount(), NOW.minusHours(2), NOW.minusHours(1), "127.0.0.1");
        User u = p.getMember().getUser();
        Wallet w = new Wallet(); w.setUser(u);
        WalletTransaction late = new WalletTransaction();
        late.setId(90L); late.setWallet(w); late.setAmount(new BigDecimal("150000"));
        late.setReferenceType("VNPAY_LATE_REFUND"); late.setReferenceId("REFLATE:LATE_REFUND"); late.setCreatedAt(NOW);
        WalletTransaction order = new WalletTransaction();
        order.setId(91L); order.setWallet(w); order.setAmount(new BigDecimal("99000"));
        order.setReferenceType("ORDER_REFUND"); order.setReferenceId("ORDER_LATE_REFUND_REFGONE"); order.setCreatedAt(NOW);
        when(wallet.findLateRefunds(any(), any(), any())).thenReturn(new PageImpl<>(List.of(late, order)));
        when(attempts.findAllByReferenceIn(anyCollection())).thenReturn(List.of(t));

        var rows = service.lateRefunds(null, null, 0, 20).getContent();

        assertEquals("VNPAY_LATE_REFUND", rows.get(0).kind());
        assertEquals("REFLATE", rows.get(0).reference());
        assertEquals(11L, rows.get(0).paymentId());
        assertEquals("success", rows.get(0).paymentStatus());
        assertEquals("Nguyễn An", rows.get(0).member().fullName());
        assertEquals("ORDER_LATE_REFUND", rows.get(1).kind());
        assertEquals("REFGONE", rows.get(1).reference());
        assertNull(rows.get(1).paymentId());
    }

    @Test
    void timelineMergesEverythingInTimeOrder() {
        Payment p = payment(11L, "success");
        p.setPaidAt(NOW.minusHours(1));
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber("INV-1");
        invoice.setIssuedAt(NOW.minusMinutes(50));
        p.setInvoice(invoice);
        var a1 = new VnpayTransaction("R1", p, p.getAmount(), NOW.minusHours(2), NOW.minusHours(2).plusMinutes(15), "127.0.0.1");
        a1.setStatus("failed");
        var a2 = new VnpayTransaction("R2", p, p.getAmount(), NOW.minusMinutes(70), NOW.minusMinutes(55), "127.0.0.1");
        a2.setStatus("success");
        when(payments.findById(11L)).thenReturn(Optional.of(p));
        when(attempts.findAllByPaymentId(11L)).thenReturn(List.of(a2, a1));
        var cb = new VnpayIpnEvent("R2", "IPN", "00", "00", "123", new BigDecimal("150000"), "00", NOW.minusMinutes(61));
        when(callbacks.findAllByReferenceInOrderByReceivedAtAscIdAsc(anyCollection())).thenReturn(List.of(cb));
        WalletTransaction refund = new WalletTransaction();
        refund.setType("REFUND_CREDIT"); refund.setReferenceId("R1:LATE_REFUND"); refund.setAmount(p.getAmount());
        refund.setCreatedAt(NOW.minusMinutes(10));
        when(wallet.findAllByReferenceIdInOrderByCreatedAtAscIdAsc(argThat(c -> c.contains("WALLET_PAY_11")
                && c.contains("R1:LATE_REFUND") && c.contains("ORDER_LATE_REFUND_R2") && c.contains("R2:DEBIT"))))
                .thenReturn(List.of(refund));

        var t = service.timeline(11L);

        assertEquals("INV-1", t.payment().invoiceNumber());
        assertEquals(List.of("R1", "R2"), t.attempts().stream().map(x -> x.reference()).toList());
        assertEquals(List.of("PAYMENT_CREATED", "ATTEMPT_CREATED", "ATTEMPT_CREATED", "CALLBACK_RECEIVED",
                        "PAYMENT_PAID", "INVOICE_ISSUED", "WALLET_TRANSACTION"),
                t.entries().stream().map(e -> e.type()).toList());
        assertEquals(1, t.callbacks().size());
        assertEquals(1, t.walletTransactions().size());
    }

    @Test
    void timelineOfUnknownPaymentIsNotFound() {
        when(payments.findById(404L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.timeline(404L));
    }
}
