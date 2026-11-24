package com.swp391.scms.finance.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.GeneratedColumn;
import java.math.BigDecimal;

/**
 * Entity mapping table invoice_items on Supabase PostgreSQL (Module F: Thanh toán & Báo cáo).
 * Contains stored generated column amount (quantity * unit_price).
 */
@Entity
@Table(name = "invoice_items")
public class InvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /**
     * [FIX 1NF-3NF §3.6] Computed column: AS (quantity * unit_price).
     * @GeneratedColumn instructs Hibernate ORM (Code-First) to generate the database-agnostic
     * stored generated column DDL for PostgreSQL.
     * @Generated informs Hibernate to fetch the database-computed value upon INSERT and UPDATE.
     */
    @GeneratedColumn("quantity * unit_price")
    @Column(name = "amount", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Constructor rỗng cho JPA. */
    public InvoiceItem() {}

    /** Tạo dòng hàng với mô tả, số lượng và đơn giá. */
    public InvoiceItem(String description, Integer quantity, BigDecimal unitPrice) {
        this.description = description;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    /**
     * Tính tạm thành tiền (đơn giá × số lượng) trong bộ nhớ, dùng trước khi lưu.
     *
     * Helper calculation method for in-memory / preview before persistence.
     */
    public BigDecimal calculateComputedAmount() {
        if (quantity == null || unitPrice == null) {
            return BigDecimal.ZERO;
        }
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường invoice. */
    public Invoice getInvoice() {
        return invoice;
    }

    /** Gán giá trị mới cho trường invoice. */
    public void setInvoice(Invoice invoice) {
        this.invoice = invoice;
    }

    /** Lấy giá trị trường description. */
    public String getDescription() {
        return description;
    }

    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) {
        this.description = description;
    }

    /** Lấy giá trị trường quantity. */
    public Integer getQuantity() {
        return quantity;
    }

    /** Gán giá trị mới cho trường quantity. */
    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    /** Lấy giá trị trường unitPrice. */
    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    /** Gán giá trị mới cho trường unitPrice. */
    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    /** Thành tiền: giá trị do database tính nếu có, không thì tính tạm. */
    public BigDecimal getAmount() {
        return amount != null ? amount : calculateComputedAmount();
    }

    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
