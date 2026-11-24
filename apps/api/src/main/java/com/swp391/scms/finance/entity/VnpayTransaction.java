package com.swp391.scms.finance.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Bảng vnpay_transactions: một lượt thanh toán qua VNPay (mã tham chiếu, khoản thu, số tiền, thời điểm tạo/hết
 * hạn, IP, trạng thái, mã giao dịch cổng).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_vnpay_transactions_status", constraints = "status IN ('pending','success','failed')")
@Table(name = "vnpay_transactions", indexes = @Index(name = "ix_vnpay_payment_status", columnList = "payment_id,status"))
public class VnpayTransaction {
    @Id @Column(length = 32)
    private String reference;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;
    @Column(nullable = false, length = 20)
    private String status;
    @Column(name = "gateway_transaction_no", unique = true, length = 20)
    private String gatewayTransactionNo;
    /** Constructor rỗng cho JPA. */
    protected VnpayTransaction() {}
    /** Tạo lượt thanh toán mới ở trạng thái pending. */
    public VnpayTransaction(String reference, Payment payment, BigDecimal amount, LocalDateTime createdAt, LocalDateTime expiresAt, String ipAddress) {
        this.reference = reference; this.payment = payment; this.amount = amount;
        this.createdAt = createdAt; this.expiresAt = expiresAt; this.ipAddress = ipAddress; this.status = "pending";
    }
    /** Lấy giá trị trường reference. */
    public String getReference() { return reference; }
    /** Lấy giá trị trường payment. */
    public Payment getPayment() { return payment; }
    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() { return amount; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Lấy giá trị trường expiresAt. */
    public LocalDateTime getExpiresAt() { return expiresAt; }
    /** Lấy giá trị trường ipAddress. */
    public String getIpAddress() { return ipAddress; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String value) { this.status = value; }
    /** Lấy giá trị trường gatewayTransactionNo. */
    public String getGatewayTransactionNo() { return gatewayTransactionNo; }
    /** Gán giá trị mới cho trường gatewayTransactionNo. */
    public void setGatewayTransactionNo(String value) { this.gatewayTransactionNo = value; }
}
