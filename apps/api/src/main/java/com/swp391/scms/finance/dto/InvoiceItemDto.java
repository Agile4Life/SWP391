package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * Một dòng hàng trả cho client: mô tả, số lượng, đơn giá và thành tiền.
 *
 * Data Transfer Object for Invoice line item response.
 */
@Schema(description = "Chi tiết một dòng sản phẩm/dịch vụ trên hóa đơn")
public class InvoiceItemDto {

    private Long id;
    private Long invoiceId;
    private String description;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;

    /** Constructor rỗng cho Jackson. */
    public InvoiceItemDto() {}

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường invoiceId. */
    public Long getInvoiceId() {
        return invoiceId;
    }

    /** Gán giá trị mới cho trường invoiceId. */
    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
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

    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() {
        return amount;
    }

    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
