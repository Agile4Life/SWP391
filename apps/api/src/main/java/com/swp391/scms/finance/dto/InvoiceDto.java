package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Hóa đơn trả cho client: số hóa đơn, ngày xuất, tiền trước thuế, thuế, tổng, link PDF và các dòng hàng.
 *
 * Data Transfer Object for Invoice response.
 */
@Schema(description = "Thông tin hóa đơn điện tử")
public class InvoiceDto {

    private Long id;
    private Long paymentId;
    private String invoiceNumber;
    private LocalDateTime issuedAt;
    private BigDecimal subtotalAmount;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private String pdfUrl;
    private LocalDateTime createdAt;
    private List<InvoiceItemDto> items = new ArrayList<>();

    /** Constructor rỗng cho Jackson. */
    public InvoiceDto() {}

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường paymentId. */
    public Long getPaymentId() {
        return paymentId;
    }

    /** Gán giá trị mới cho trường paymentId. */
    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
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

    /** Lấy giá trị trường totalAmount. */
    public BigDecimal getTotalAmount() {
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
    public List<InvoiceItemDto> getItems() {
        return items;
    }

    /** Gán giá trị mới cho trường items. */
    public void setItems(List<InvoiceItemDto> items) {
        this.items = items;
    }
}
