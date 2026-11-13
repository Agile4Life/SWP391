package com.swp391.scms.finance.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One VNPay callback (IPN or verified return) and the code the system answered. Only non-sensitive gateway fields
 * are kept: never the secure hash, the raw query string or the caller's address.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_vnpay_ipn_events_source", constraints = "source IN ('IPN','RETURN')")
@Table(name = "vnpay_ipn_events", indexes = {
        @Index(name = "ix_vnpay_ipn_events_reference", columnList = "reference,received_at"),
        @Index(name = "ix_vnpay_ipn_events_rsp_code", columnList = "rsp_code,received_at")
})
public class VnpayIpnEvent {
    public static final String SOURCE_IPN = "IPN";
    public static final String SOURCE_RETURN = "RETURN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(length = 32)
    private String reference;
    @Column(nullable = false, length = 10)
    private String source;
    @Column(name = "gateway_response_code", length = 2)
    private String gatewayResponseCode;
    @Column(name = "gateway_transaction_status", length = 2)
    private String gatewayTransactionStatus;
    @Column(name = "gateway_transaction_no", length = 20)
    private String gatewayTransactionNo;
    @Column(precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(name = "rsp_code", nullable = false, length = 2)
    private String rspCode;
    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    protected VnpayIpnEvent() {}

    public VnpayIpnEvent(String reference, String source, String gatewayResponseCode, String gatewayTransactionStatus,
                         String gatewayTransactionNo, BigDecimal amount, String rspCode, LocalDateTime receivedAt) {
        this.reference = reference; this.source = source; this.gatewayResponseCode = gatewayResponseCode;
        this.gatewayTransactionStatus = gatewayTransactionStatus; this.gatewayTransactionNo = gatewayTransactionNo;
        this.amount = amount; this.rspCode = rspCode; this.receivedAt = receivedAt;
    }

    public Long getId() { return id; }
    public String getReference() { return reference; }
    public String getSource() { return source; }
    public String getGatewayResponseCode() { return gatewayResponseCode; }
    public String getGatewayTransactionStatus() { return gatewayTransactionStatus; }
    public String getGatewayTransactionNo() { return gatewayTransactionNo; }
    public BigDecimal getAmount() { return amount; }
    public String getRspCode() { return rspCode; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
}
