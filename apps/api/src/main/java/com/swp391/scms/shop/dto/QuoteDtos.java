package com.swp391.scms.shop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

/** Nhóm các DTO cho báo giá giỏ hàng. */
public final class QuoteDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private QuoteDtos() {}

    /** Một dòng yêu cầu báo giá: biến thể và số lượng (tối thiểu 1). */
    public record QuoteLineRequest(
            @NotNull Long variantId,
            @Min(1) int quantity
    ) {}

    /** Yêu cầu báo giá: các dòng sản phẩm và hình thức nhận hàng. */
    public record QuoteRequest(
            @NotEmpty List<@Valid QuoteLineRequest> items,
            String fulfillment
    ) {}

    /**
     * Một dòng báo giá: sản phẩm, nhãn, ảnh, đơn giá, số lượng yêu cầu/được duyệt, tồn kho, thành tiền và vấn
     * đề (nếu có).
     */
    public record QuoteLineDto(
            Long variantId,
            String productName,
            String variantLabel,
            String slug,
            String imageUrl,
            BigDecimal unitPrice,
            int requestedQuantity,
            int quantity,
            int stock,
            BigDecimal lineTotal,
            String problem
    ) {}

    /** Kết quả báo giá: các dòng, tạm tính, phí ship, tổng tiền, hợp lệ hay không, % và số tiền giảm giá. */
    public record QuoteDto(
            List<QuoteLineDto> lines,
            BigDecimal subtotal,
            BigDecimal shippingFee,
            BigDecimal total,
            boolean valid,
            /** Member tier discount on the products, 0 for anonymous shoppers and Silver; already inside {@code total}. */
            int discountPercent,
            BigDecimal discountAmount
    ) {
        /** Constructor rút gọn không có giảm giá. */
        public QuoteDto(List<QuoteLineDto> lines, BigDecimal subtotal, BigDecimal shippingFee, BigDecimal total, boolean valid) {
            this(lines, subtotal, shippingFee, total, valid, 0, BigDecimal.ZERO);
        }
    }
}
