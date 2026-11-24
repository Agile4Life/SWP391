package com.swp391.scms.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Nhóm DTO cho màn đối soát thanh toán của Admin.
 *
 * Read-only views for the admin payment reconciliation page.
 */
public final class ReconciliationDtos {
    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private ReconciliationDtos() {}

    /**
     * Tổng quan đối soát trong khoảng ngày: lượt VNPay treo/đang chờ, số và tiền hoàn muộn, callback cần thử
     * lại/bị từ chối, số khoản có nhiều lượt thanh toán và các bất thường.
     */
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
     * Số bất thường: lượt VNPay thành công trên khoản chưa trả, khoản trả online không có nguồn tiền, và tổng.
     *
     * {@code walletPaymentWithoutSource}: an online payment marked paid without a successful attempt or wallet debit. */
    public record AnomalyCounts(long successAttemptUnpaid, long walletPaymentWithoutSource, long total) {}

    /** Thông tin ngắn của hội viên: id, họ tên, email, SĐT. */
    public record MemberRef(Long userId, String fullName, String email, String phone) {}

    /**
     * Một dòng lượt thanh toán VNPay: mã tham chiếu, khoản thu, hội viên, số tiền, trạng thái, có bị treo
     * không, trạng thái khoản thu, đối tượng, thời điểm tạo/hết hạn, mã giao dịch cổng và số lượt.
     */
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

    /** Một dòng hoàn tiền muộn: giao dịch ví, thời điểm, hội viên, số tiền và mã tham chiếu VNPay. */
    public record LateRefundRowDto(
            Long walletTransactionId,
            LocalDateTime createdAt,
            MemberRef member,
            BigDecimal amount,
            String kind,
            String reference,
            Long paymentId,
            String paymentStatus) {}

    /**
     * Một dòng callback VNPay: mã tham chiếu, nguồn (IPN/return), mã phản hồi cổng, trạng thái, số tiền, mã trả
     * lời và thời điểm nhận.
     */
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

    /** Thông tin khoản thanh toán trên dòng thời gian đối soát. */
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

    /** Một bút toán ví liên quan tới khoản thanh toán. */
    public record WalletEntryDto(
            Long id,
            String type,
            String referenceType,
            String referenceId,
            BigDecimal amount,
            LocalDateTime createdAt) {}

    /**
     * Một mốc trên dòng thời gian của khoản thanh toán.
     *
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

    /**
     * Dòng thời gian đầy đủ của một khoản thanh toán: thông tin, các lượt VNPay, callback, bút toán ví và các
     * mốc.
     */
    public record PaymentTimelineDto(
            PaymentInfoDto payment,
            List<VnpayAttemptRowDto> attempts,
            List<IpnEventRowDto> callbacks,
            List<WalletEntryDto> walletTransactions,
            List<TimelineEntryDto> entries) {}
}
