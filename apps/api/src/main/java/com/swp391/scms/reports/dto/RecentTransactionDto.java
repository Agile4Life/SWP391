package com.swp391.scms.reports.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Một giao dịch gần đây: id, số hóa đơn, hội viên (tên, email, SĐT), tên gói/lớp, số tiền trung tâm giữ lại,
 * phương thức và thời điểm.
 */
public record RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                   String email, String phone,
                                   String packageName, BigDecimal amount, String method,
                                   LocalDateTime paidAt) {

    /** Constructor rút gọn không có email và SĐT. */
    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String packageName, BigDecimal amount, String method,
                                LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, null, null, packageName, amount, method, paidAt);
    }

    /**
     * Các dòng báo cáo hiển thị số tiền trung tâm thực giữ: số tiền đã thu trừ đi phần hoàn tiền một phần (nếu
     * có), không bao gồm email và SĐT.
     */
    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String packageName, BigDecimal amount, BigDecimal refundedAmount, String method, LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, null, null, packageName,
                amount == null || refundedAmount == null ? amount : amount.subtract(refundedAmount), method, paidAt);
    }

    /** Constructor dùng bởi câu truy vấn báo cáo: có email/SĐT và tính số tiền giữ lại = đã thu trừ đã hoàn. */
    public RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                String email, String phone,
                                String packageName, BigDecimal amount, BigDecimal refundedAmount, String method, LocalDateTime paidAt) {
        this(id, invoiceNumber, memberName, email, phone, packageName,
                amount == null || refundedAmount == null ? amount : amount.subtract(refundedAmount), method, paidAt);
    }
}
