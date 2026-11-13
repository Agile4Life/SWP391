package com.swp391.scms.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Read-only views for the admin payment reconciliation page. */
public final class ReconciliationDtos {
    private ReconciliationDtos() {}

    public record ReconciliationSummaryDto(
            LocalDate from,
            LocalDate to,
            long staleAttempts,
            long pendingAttempts,
            long lateRefundCount,
            BigDecimal lateRefundAmount,
            long ipnRetryable,
            long ipnRejected,
            long multiAttemptPayments,
            AnomalyCounts anomalies) {}

    /** {@code successAttemptUnpaid}: a successful VNPay attempt on a payment that is not paid or refunded;
     * {@code walletPaymentWithoutSource}: an online payment marked paid without a successful attempt or wallet debit. */
    public record AnomalyCounts(long successAttemptUnpaid, long walletPaymentWithoutSource, long total) {}

    public record MemberRef(Long userId, String fullName, String email, String phone) {}

    public record VnpayAttemptRowDto(
            String reference,
            Long paymentId,
            MemberRef member,
            BigDecimal amount,
            String status,
            boolean stale,
            String paymentStatus,
            String targetType,
            Long targetId,
            LocalDateTime createdAt,
            LocalDateTime expiresAt,
            String gatewayTransactionNo,
            long attemptCount) {}

    public record LateRefundRowDto(
            Long walletTransactionId,
            LocalDateTime createdAt,
            MemberRef member,
            BigDecimal amount,
            String kind,
            String reference,
            Long paymentId,
            String paymentStatus) {}

    public record IpnEventRowDto(
            Long id,
            String reference,
            String source,
            String gatewayResponseCode,
            String gatewayTransactionStatus,
            String gatewayTransactionNo,
            BigDecimal amount,
            String rspCode,
            LocalDateTime receivedAt) {}

    public record PaymentInfoDto(
            Long id,
            MemberRef member,
            BigDecimal amount,
            BigDecimal refundedAmount,
            String method,
            String status,
            String targetType,
            Long targetId,
            LocalDateTime createdAt,
            LocalDateTime paidAt,
            String invoiceNumber) {}

    public record WalletEntryDto(
            Long id,
            String type,
            String referenceType,
            String referenceId,
            BigDecimal amount,
            LocalDateTime createdAt) {}

    /**
     * One step in a payment's history. {@code type} is one of PAYMENT_CREATED, ATTEMPT_CREATED, CALLBACK_RECEIVED,
     * WALLET_TRANSACTION, PAYMENT_PAID, INVOICE_ISSUED; the other fields are filled when they apply.
     */
    public record TimelineEntryDto(
            LocalDateTime at,
            String type,
            String reference,
            String status,
            String code,
            String source,
            BigDecimal amount,
            String detail) {}

    public record PaymentTimelineDto(
            PaymentInfoDto payment,
            List<VnpayAttemptRowDto> attempts,
            List<IpnEventRowDto> callbacks,
            List<WalletEntryDto> walletTransactions,
            List<TimelineEntryDto> entries) {}
}
