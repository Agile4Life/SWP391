package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * Data Transfer Object for creating an Invoice line item.
 */
@Schema(description = "Yêu cầu tạo chi tiết dòng hóa đơn")
public class InvoiceItemCreateDto {

    @NotBlank(message = "{validation.invoice.item.description.not_blank}")
    @Schema(description = "Mô tả dịch vụ", example = "Gói tập Gold 6 tháng")
    private String description;

    @NotNull(message = "{validation.invoice.item.quantity.not_null}")
    @Min(value = 1, message = "{validation.invoice.item.quantity.min}")
    @Schema(description = "Số lượng", example = "1")
    private Integer quantity = 1;

    @NotNull(message = "{validation.invoice.item.unit_price.not_null}")
    @DecimalMin(value = "0.0", message = "{validation.invoice.item.unit_price.min}")
    @Schema(description = "Đơn giá (VNĐ)", example = "3000000.00")
    private BigDecimal unitPrice;

    public InvoiceItemCreateDto() {}

    public InvoiceItemCreateDto(String description, Integer quantity, BigDecimal unitPrice) {
        this.description = description;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
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
}
