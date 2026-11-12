package com.swp391.scms.reports.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                   String email, String phone,
                                   String packageName, BigDecimal amount, String method,
                                   LocalDateTime paidAt) {

    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String packageName, BigDecimal amount, String method,
                                LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, null, null, packageName, amount, method, paidAt);
    }

    /** Report rows show what the centre kept: the paid amount minus any partial refund. */
    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String packageName, BigDecimal amount, BigDecimal refundedAmount, String method, LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, null, null, packageName,
                amount == null || refundedAmount == null ? amount : amount.subtract(refundedAmount), method, paidAt);
    }

    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String email, String phone,
                                String packageName, BigDecimal amount, BigDecimal refundedAmount, String method, LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, email, phone, packageName,
                amount == null || refundedAmount == null ? amount : amount.subtract(refundedAmount), method, paidAt);
    }
}
