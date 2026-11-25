package com.swp391.scms.finance;

import com.swp391.scms.finance.service.VnpayPaymentGuard;
import com.swp391.scms.finance.service.VnpayExpiryScheduler;
import com.swp391.scms.finance.repository.*;
import com.swp391.scms.common.exception.ConflictException;
import org.junit.jupiter.api.Test;
import com.swp391.scms.finance.entity.*;
import java.time.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho VnpayPaymentGuard (vnpay payment guard). */
class VnpayPaymentGuardTest {
    @Test void unsettledAttemptBlocksCashierAndRefundEvenAfterLocalTimeout() {
        var transactions=mock(VnpayTransactionRepository.class);
        when(transactions.existsByPaymentIdAndStatus(9L,"pending")).thenReturn(true);
        var guard=new VnpayPaymentGuard(transactions,mock(PaymentRepository.class));
        assertThrows(ConflictException.class,()->guard.payment(9L));assertThrows(ConflictException.class,()->guard.refund(9L));
    }
    @Test void successfulGatewayPaymentCannotBeRefundedByLocalBookkeeping() {
        var transactions=mock(VnpayTransactionRepository.class);
        when(transactions.existsByPaymentIdAndStatus(9L,"success")).thenReturn(true);
        var guard=new VnpayPaymentGuard(transactions,mock(PaymentRepository.class));
        assertThrows(ConflictException.class,()->guard.refund(9L));
    }
    final Clock clock=Clock.fixed(Instant.parse("2026-11-03T05:00:00Z"),ZoneId.of("Asia/Ho_Chi_Minh")); // 12:00 theo giờ trung tâm
    /** Hàm trợ giúp của test: tạo lần thử thanh toán VNPay mẫu. */
    VnpayTransaction attempt(String ref, LocalDateTime expires) {
        var payment=new Payment();payment.setId(9L);
        return new VnpayTransaction(ref,payment,java.math.BigDecimal.TEN,expires.minusMinutes(15),expires,"127.0.0.1");
    }
    @Test void abandonedAttemptPastGatewayExpiryAndGraceIsClosedAndNoLongerBlocks() {
        var transactions=mock(VnpayTransactionRepository.class);
        var abandoned=attempt("OLD",LocalDateTime.of(2026,11,3,11,30));
        when(transactions.findAllByPaymentId(9L)).thenReturn(List.of(abandoned));
        var guard=new VnpayPaymentGuard(transactions,mock(PaymentRepository.class),clock);
        assertDoesNotThrow(()->guard.payment(9L));
        assertEquals("failed",abandoned.getStatus());verify(transactions).save(abandoned);
    }
    @Test void attemptWithinIpnGraceStillBlocks() {
        var transactions=mock(VnpayTransactionRepository.class);
        var recent=attempt("NEW",LocalDateTime.of(2026,11,3,11,50));
        when(transactions.findAllByPaymentId(9L)).thenReturn(List.of(recent));
        when(transactions.existsByPaymentIdAndStatus(9L,"pending")).thenReturn(true);
        var guard=new VnpayPaymentGuard(transactions,mock(PaymentRepository.class),clock);
        assertThrows(ConflictException.class,()->guard.payment(9L));
        assertEquals("pending",recent.getStatus());verify(transactions,never()).save(any());
    }
    @Test void schedulerClosesEveryPaymentWithAnAbandonedAttempt() {
        var transactions=mock(VnpayTransactionRepository.class);
        var abandoned=attempt("OLD",LocalDateTime.of(2026,11,3,11,0));
        when(transactions.findPaymentIdsWithPendingExpiredBefore(LocalDateTime.of(2026,11,3,11,45))).thenReturn(List.of(9L));
        when(transactions.findAllByPaymentId(9L)).thenReturn(List.of(abandoned));
        var guard=new VnpayPaymentGuard(transactions,mock(PaymentRepository.class),clock);
        assertEquals(1,new VnpayExpiryScheduler(transactions,guard).closeAbandonedAttempts());
        assertEquals("failed",abandoned.getStatus());
    }

    @Test void expiringStaleWalletTopupAlsoClosesStandaloneTopupPayment() {
        var transactions = mock(VnpayTransactionRepository.class);
        var payments = mock(PaymentRepository.class);
        var topup = new Payment();
        topup.setId(88L);
        topup.setStatus("pending");
        topup.setMethod("online_wallet");
        topup.setNote("WALLET_TOPUP");
        var stale = new VnpayTransaction("OLDTOPUP", topup, java.math.BigDecimal.TEN,
                LocalDateTime.of(2026, 11, 3, 11, 0), LocalDateTime.of(2026, 11, 3, 11, 15), "127.0.0.1");
        when(transactions.findAllByPaymentId(88L)).thenReturn(List.of(stale));
        when(payments.findById(88L)).thenReturn(java.util.Optional.of(topup));

        var guard = new VnpayPaymentGuard(transactions, payments, clock);
        guard.expireStale(88L);

        assertEquals("failed", stale.getStatus());
        assertEquals("failed", topup.getStatus());
        verify(payments).save(topup);
    }

    @Test void expireStaleUsesAtomicUpdateAndNeverOverwritesAlreadySettledAttempt() throws Exception {
        var transactions = mock(VnpayTransactionRepository.class);
        var payments = mock(PaymentRepository.class);
        LocalDateTime expectedCutoff = LocalDateTime.of(2026, 11, 3, 11, 45);
        when(transactions.failStalePendingAttempts(88L, expectedCutoff)).thenReturn(1);
        when(payments.failOrphanPendingWalletTopup(88L)).thenReturn(1);

        var guard = new VnpayPaymentGuard(transactions, payments, clock);
        guard.expireStale(88L);

        verify(transactions).failStalePendingAttempts(88L, expectedCutoff);
        verify(transactions, never()).findAllByPaymentId(88L);
        verify(transactions, never()).save(any());
        verify(payments).failOrphanPendingWalletTopup(88L);
        verify(payments, never()).save(any());

        // Giao dịch đã có mã giao dịch cổng (IPN vừa xác nhận) tuyệt đối không bị đánh dấu stale hay ghi đè failed.
        var transactions2 = mock(VnpayTransactionRepository.class);
        var settled = attempt("SETTLED", LocalDateTime.of(2026, 11, 3, 11, 0));
        settled.setGatewayTransactionNo("999888");
        settled.setStatus("success");
        var pendingWithGatewayNo = attempt("INFLIGHT", LocalDateTime.of(2026, 11, 3, 11, 0));
        pendingWithGatewayNo.setGatewayTransactionNo("999889");
        when(transactions2.findAllByPaymentId(99L)).thenReturn(List.of(settled, pendingWithGatewayNo));

        var guard2 = new VnpayPaymentGuard(transactions2, mock(PaymentRepository.class), clock);
        guard2.expireStale(99L);

        assertEquals("success", settled.getStatus());
        assertEquals("pending", pendingWithGatewayNo.getStatus());
        verify(transactions2, never()).save(any());

        // Entity VnpayTransaction phải có @Version để bảo vệ khóa lạc quan.
        var versionField = VnpayTransaction.class.getDeclaredField("version");
        assertNotNull(versionField.getAnnotation(jakarta.persistence.Version.class));
    }

    @Test void schedulerIsolatesFailuresPerPaymentInIndependentTransactions() {
        var transactions = mock(VnpayTransactionRepository.class);
        var guard = mock(VnpayPaymentGuard.class);
        var txManager = mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenAnswer(inv -> new org.springframework.transaction.support.SimpleTransactionStatus());
        when(guard.now()).thenReturn(LocalDateTime.of(2026, 11, 3, 12, 0));
        when(transactions.findPaymentIdsWithPendingExpiredBefore(LocalDateTime.of(2026, 11, 3, 11, 45)))
                .thenReturn(List.of(9L, 10L));
        doThrow(new RuntimeException("Optimistic lock conflict with IPN")).when(guard).expireStale(9L);
        doNothing().when(guard).expireStale(10L);

        var scheduler = new VnpayExpiryScheduler(transactions, guard, txManager);
        assertEquals(1, scheduler.closeAbandonedAttempts());

        verify(guard).expireStale(9L);
        verify(guard).expireStale(10L);
        verify(txManager, times(2)).getTransaction(argThat(def ->
                def.getPropagationBehavior() == org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(txManager, times(1)).rollback(any());
        verify(txManager, times(1)).commit(any());
    }
}
