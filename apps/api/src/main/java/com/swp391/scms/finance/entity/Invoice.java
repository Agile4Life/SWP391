package com.swp391.scms.finance.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.GeneratedColumn;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity mapping table invoices on Supabase PostgreSQL (Module F: Thanh toán & Báo cáo).
 * Contains stored generated column total_amount (subtotal_amount + tax_amount).
 */
@Entity
@Table(name = "invoices")
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", nullable = false, unique = true)
    private Payment payment;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 50)
    private String invoiceNumber;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotalAmount;

    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    /**
     * [FIX 1NF-3NF §3.6] Computed column: AS (subtotal_amount + tax_amount).
     * @GeneratedColumn instructs Hibernate ORM (Code-First) to generate the database-agnostic
     * stored generated column DDL for PostgreSQL.
     * @Generated informs Hibernate to fetch the database-computed value upon INSERT and UPDATE.
     */
    @GeneratedColumn("subtotal_amount + tax_amount")
    @Column(name = "total_amount", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "pdf_url", length = 255)
    private String pdfUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InvoiceItem> items = new ArrayList<>();

    public Invoice() {}

    public void addItem(InvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }

    public void removeItem(InvoiceItem item) {
        items.remove(item);
        item.setInvoice(null);
    }

    /**
     * Helper calculation method for in-memory / preview before persistence.
     */
    public BigDecimal calculateComputedTotal() {
        BigDecimal sub = subtotalAmount != null ? subtotalAmount : BigDecimal.ZERO;
        BigDecimal tax = taxAmount != null ? taxAmount : BigDecimal.ZERO;
        return sub.add(tax);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Payment getPayment() {
        return payment;
    }

    public void setPayment(Payment payment) {
        this.payment = payment;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public LocalDateTime getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(LocalDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    public BigDecimal getSubtotalAmount() {
        return subtotalAmount;
    }

    public void setSubtotalAmount(BigDecimal subtotalAmount) {
        this.subtotalAmount = subtotalAmount;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount != null ? totalAmount : calculateComputedTotal();
    }

    public BigDecimal getPersistedTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getPdfUrl() {
        return pdfUrl;
    }

    public void setPdfUrl(String pdfUrl) {
        this.pdfUrl = pdfUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<InvoiceItem> getItems() {
        return items;
    }

    public void setItems(List<InvoiceItem> items) {
        this.items = items;
    }
}
