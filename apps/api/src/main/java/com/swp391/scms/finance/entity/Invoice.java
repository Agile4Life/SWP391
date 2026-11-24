package com.swp391.scms.finance.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.GeneratedColumn;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity mapping table invoices on Supabase PostgreSQL (Module F: Thanh toán & Báo cáo).
 * Chứa cột tính toán được lưu total_amount (subtotal_amount + tax_amount).
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
     * DDL cột tính toán được lưu cho PostgreSQL.
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

    /** Constructor rỗng cho JPA. */
    public Invoice() {}

    /** Thêm dòng hàng vào hóa đơn và gắn hai chiều. */
    public void addItem(InvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }

    /** Bỏ dòng hàng khỏi hóa đơn. */
    public void removeItem(InvoiceItem item) {
        items.remove(item);
        item.setInvoice(null);
    }

    /**
     * Tính tạm tổng tiền (trước thuế + thuế) trong bộ nhớ, dùng trước khi lưu.
     *
     * Phương thức tính trợ giúp cho bộ nhớ / xem trước trước khi lưu.
     */
    public BigDecimal calculateComputedTotal() {
        BigDecimal sub = subtotalAmount != null ? subtotalAmount : BigDecimal.ZERO;
        BigDecimal tax = taxAmount != null ? taxAmount : BigDecimal.ZERO;
        return sub.add(tax);
    }

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường payment. */
    public Payment getPayment() {
        return payment;
    }

    /** Gán giá trị mới cho trường payment. */
    public void setPayment(Payment payment) {
        this.payment = payment;
    }

    /** Lấy giá trị trường invoiceNumber. */
    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    /** Gán giá trị mới cho trường invoiceNumber. */
    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    /** Lấy giá trị trường issuedAt. */
    public LocalDateTime getIssuedAt() {
        return issuedAt;
    }

    /** Gán giá trị mới cho trường issuedAt. */
    public void setIssuedAt(LocalDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    /** Lấy giá trị trường subtotalAmount. */
    public BigDecimal getSubtotalAmount() {
        return subtotalAmount;
    }

    /** Gán giá trị mới cho trường subtotalAmount. */
    public void setSubtotalAmount(BigDecimal subtotalAmount) {
        this.subtotalAmount = subtotalAmount;
    }

    /** Lấy giá trị trường taxAmount. */
    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    /** Gán giá trị mới cho trường taxAmount. */
    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    /** Tổng tiền: giá trị do database tính (cột sinh tự động) nếu có, không thì tính tạm. */
    public BigDecimal getTotalAmount() {
        return totalAmount != null ? totalAmount : calculateComputedTotal();
    }

    /** Lấy giá trị trường persistedTotalAmount. */
    public BigDecimal getPersistedTotalAmount() {
        return totalAmount;
    }

    /** Gán giá trị mới cho trường totalAmount. */
    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    /** Lấy giá trị trường pdfUrl. */
    public String getPdfUrl() {
        return pdfUrl;
    }

    /** Gán giá trị mới cho trường pdfUrl. */
    public void setPdfUrl(String pdfUrl) {
        this.pdfUrl = pdfUrl;
    }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /** Lấy giá trị trường items. */
    public List<InvoiceItem> getItems() {
        return items;
    }

    /** Gán giá trị mới cho trường items. */
    public void setItems(List<InvoiceItem> items) {
        this.items = items;
    }
}
