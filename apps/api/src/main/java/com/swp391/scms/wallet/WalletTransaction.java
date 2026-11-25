package com.swp391.scms.wallet;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "wallet_transactions", indexes = {
        @Index(name = "ix_wallet_tx_wallet_created", columnList = "wallet_id, created_at"),
        @Index(name = "ix_wallet_tx_reference", columnList = "reference_id")
})
/**
 * Bảng wallet_transactions: một biến động của ví (loại nạp/trừ/hoàn, số tiền, số dư sau, loại và mã tham chiếu,
 * mô tả, thời điểm).
 */
public class WalletTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Column(nullable = false, length = 30)
    private String type; // TOPUP_VNPAY, PAYMENT_DEBIT, REFUND_CREDIT

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 15, scale = 2)
    private BigDecimal balanceAfter;

    @Column(name = "reference_type", length = 50)
    private String referenceType;

    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @Column(length = 500)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Constructor rỗng cho JPA. */
    public WalletTransaction() {}

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường wallet. */
    public Wallet getWallet() {
        return wallet;
    }

    /** Gán giá trị mới cho trường wallet. */
    public void setWallet(Wallet wallet) {
        this.wallet = wallet;
    }

    /** Lấy giá trị trường type. */
    public String getType() {
        return type;
    }

    /** Gán giá trị mới cho trường type. */
    public void setType(String type) {
        this.type = type;
    }

    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() {
        return amount;
    }

    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /** Lấy giá trị trường balanceAfter. */
    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }

    /** Gán giá trị mới cho trường balanceAfter. */
    public void setBalanceAfter(BigDecimal balanceAfter) {
        this.balanceAfter = balanceAfter;
    }

    /** Lấy giá trị trường referenceType. */
    public String getReferenceType() {
        return referenceType;
    }

    /** Gán giá trị mới cho trường referenceType. */
    public void setReferenceType(String referenceType) {
        this.referenceType = referenceType;
    }

    /** Lấy giá trị trường referenceId. */
    public String getReferenceId() {
        return referenceId;
    }

    /** Gán giá trị mới cho trường referenceId. */
    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    /** Lấy giá trị trường description. */
    public String getDescription() {
        return description;
    }

    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) {
        this.description = description;
    }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
