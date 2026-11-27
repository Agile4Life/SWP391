package com.swp391.scms.membership;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MembershipRequestHistoryService;
import com.swp391.scms.membership.dto.SubscriptionResponses.RequestHistoryDto;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.wallet.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class MembershipHistoryPaymentSourceTest {
    final PaymentRepository payments = mock(PaymentRepository.class);
    final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    final VnpayTransactionRepository attempts = mock(VnpayTransactionRepository.class);
    final WalletTransactionRepository ledger = mock(WalletTransactionRepository.class);
    final Payment payment = mock(Payment.class);
    final MembershipSubscription sub = new MembershipSubscription();
    final List<VnpayTransaction> transactions = new ArrayList<>();
    final List<WalletTransaction> entries = new ArrayList<>();
    final BigDecimal amount = new BigDecimal("200000");
    MembershipRequestHistoryService service;

    @BeforeEach void setup() {
        User user = new User(); user.setId(10L); user.setFullName("Member");
        Member member = new Member(); member.setUserId(10L); member.setUser(user);
        sub.setId(50L); sub.setMember(member); sub.setQuotedPrice(new BigDecimal("250000"));
        when(payment.getId()).thenReturn(7L); when(payment.getMember()).thenReturn(member);
        when(payment.getSubscription()).thenReturn(sub); when(payment.getAmount()).thenReturn(amount);
        when(payment.getStatus()).thenReturn("success"); when(payment.getMethod()).thenReturn("online_wallet");
        when(payment.getPaidAt()).thenReturn(LocalDateTime.of(2026, 11, 25, 10, 0));
        when(payments.findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(anyList())).thenReturn(List.of(payment));
        when(attempts.findAllByPaymentIdIn(anyCollection())).thenAnswer(i -> transactions);
        when(ledger.findByReferenceIdIn(anyCollection())).thenAnswer(i -> entries);
        service = new MembershipRequestHistoryService(payments, subscriptions,
                Clock.fixed(Instant.parse("2026-11-26T03:00:00Z"), ZoneOffset.ofHours(7)), attempts, ledger);
    }

    RequestHistoryDto row() { return service.history(0).getFirst(); }
    VnpayTransaction attempt(String ref, String status) {
        var t = new VnpayTransaction(ref, payment, amount, payment.getPaidAt().minusMinutes(2), payment.getPaidAt().plusMinutes(15), "127.0.0.1");
        t.setStatus(status); t.setGatewayTransactionNo("123456"); transactions.add(t); return t;
    }
    WalletTransaction entry(String ref, String type, String referenceType) {
        Wallet w = new Wallet(); w.setUser(payment.getMember().getUser());
        WalletTransaction e = new WalletTransaction(); e.setWallet(w); e.setAmount(amount);
        e.setReferenceId(ref); e.setType(type); e.setReferenceType(referenceType); entries.add(e); return e;
    }
    void gateway(String ref) {
        attempt(ref, "success"); entry(ref + ":TOPUP", "TOPUP_VNPAY", "VNPAY"); entry(ref + ":DEBIT", "PAYMENT_DEBIT", "VNPAY");
    }

    @Test void vnpayNeedsSettledAttemptAndMatchingLedger() {
        gateway("G1"); assertEquals("VNPAY", row().actualPaymentMethod());
        assertEquals(amount, row().paidAmount()); assertEquals(new BigDecimal("250000"), row().quotedAmount());
    }
    @Test void walletUsesExactPaymentDebitNotSyntheticGatewayDebit() {
        attempt("FAILED", "failed"); entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT");
        assertEquals("WALLET", row().actualPaymentMethod());
    }
    @Test void cashAndFailedVnpayThenCash() {
        when(payment.getMethod()).thenReturn("cash"); assertEquals("CASH", row().actualPaymentMethod());
        attempt("FAILED", "failed"); assertEquals("CASH", row().actualPaymentMethod());
    }
    @Test void lateSuccessfulGatewayRefundDoesNotReplaceWalletSourceOrRefundOriginalPayment() {
        entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT");
        attempt("LATE", "success"); entry("LATE:LATE_REFUND", "REFUND_CREDIT", "VNPAY_LATE_REFUND");
        assertEquals("WALLET", row().actualPaymentMethod());
        assertEquals(amount, row().lateGatewayRefundedAmount()); assertNull(row().refundedAmount());
    }
    @Test void refundedPaymentKeepsGrossPaidAndRecordedRefundSeparate() {
        gateway("G1"); when(payment.getStatus()).thenReturn("refunded"); when(payment.getRefundedAmount()).thenReturn(amount);
        assertEquals(amount, row().paidAmount()); assertEquals(amount, row().refundedAmount()); assertEquals("refunded", row().paymentStatus());
    }
    @Test void unpaidCancellationNeverReportsQuoteAsCollected() {
        when(payments.findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(anyList())).thenReturn(List.of());
        when(subscriptions.findByStatusOrderByUpdatedAtDesc("cancelled")).thenReturn(List.of(sub));
        assertEquals("UNPAID", row().actualPaymentMethod()); assertEquals(BigDecimal.ZERO, row().paidAmount());
        assertEquals(BigDecimal.ZERO, row().amount()); assertEquals(new BigDecimal("250000"), row().quotedAmount());
    }
    @Test void missingLegacyEvidenceOrAttemptAloneIsUnknown() {
        assertEquals("UNKNOWN", row().actualPaymentMethod()); attempt("G1", "success");
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void mismatchedMemberAmountAndConflictingSourcesAreUnknown() {
        var debit = entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT"); debit.setAmount(BigDecimal.ONE);
        assertEquals("UNKNOWN", row().actualPaymentMethod()); debit.setAmount(amount);
        debit.getWallet().getUser().setId(99L);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void conflictingFullSourcesAreUnknown() {
        gateway("G1"); entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT");
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void lateGatewayAfterCashAndPartialPaymentRefundRemainSeparate() {
        when(payment.getMethod()).thenReturn("cash");
        attempt("LATE", "success"); entry("LATE:LATE_REFUND", "REFUND_CREDIT", "VNPAY_LATE_REFUND");
        when(payment.getRefundedAmount()).thenReturn(new BigDecimal("50000"));
        assertEquals("CASH", row().actualPaymentMethod());
        assertEquals(amount, row().paidAmount()); assertEquals(new BigDecimal("50000"), row().refundedAmount());
        assertEquals(amount, row().lateGatewayRefundedAmount());
    }
    @Test void unrelatedPaymentAttemptAndWrongAmountOrOwnerNeverProveVnpay() {
        gateway("G1");
        Payment other = mock(Payment.class); when(other.getId()).thenReturn(99L);
        transactions.clear();
        var unrelated = new VnpayTransaction("G1", other, amount, payment.getPaidAt(), payment.getPaidAt(), "127.0.0.1");
        unrelated.setStatus("success"); unrelated.setGatewayTransactionNo("123456"); transactions.add(unrelated);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
        transactions.clear(); attempt("G1", "success"); entries.getFirst().setAmount(BigDecimal.ONE);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void cancelledUpgradeUsesPersistedUpgradeQuoteWithoutCurrentPackagePrice() {
        when(payments.findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(anyList())).thenReturn(List.of());
        when(subscriptions.findByStatusOrderByUpdatedAtDesc("cancelled")).thenReturn(List.of(sub));
        sub.setUpgradeCharge(new BigDecimal("50000"));
        assertEquals(new BigDecimal("50000"), row().quotedAmount()); assertEquals(BigDecimal.ZERO, row().paidAmount());
    }
    @Test void paymentMemberMustMatchTheDisplayedSubscriptionMember() {
        gateway("G1");
        Member other = new Member(); other.setUserId(99L); when(payment.getMember()).thenReturn(other);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void unpaidCancelledRequestCanHaveASeparateLateGatewayReturn() {
        when(payments.findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(anyList())).thenReturn(List.of());
        when(subscriptions.findByStatusOrderByUpdatedAtDesc("cancelled")).thenReturn(List.of(sub));
        when(payments.findAllBySubscriptionId(50L)).thenReturn(List.of(payment));
        when(payment.getStatus()).thenReturn("failed");
        attempt("LATE", "success"); entry("LATE:LATE_REFUND", "REFUND_CREDIT", "VNPAY_LATE_REFUND");
        assertEquals("UNPAID", row().actualPaymentMethod()); assertEquals(BigDecimal.ZERO, row().paidAmount());
        assertEquals(amount, row().lateGatewayRefundedAmount());
    }
    @Test void conflictingWalletReferenceCannotChooseTheOneConvenientMatchingRecord() {
        entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT");
        entry("WALLET_PAY_7", "PAYMENT_DEBIT", "WALLET_PAYMENT").setAmount(BigDecimal.ONE);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
    @Test void conflictingGatewayReferenceCannotChooseTheOneConvenientMatchingRecord() {
        gateway("G1"); entry("G1:DEBIT", "PAYMENT_DEBIT", "VNPAY").setAmount(BigDecimal.ONE);
        assertEquals("UNKNOWN", row().actualPaymentMethod());
    }
}
