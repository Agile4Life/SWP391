package com.swp391.scms.shop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public final class QuoteDtos {
    private QuoteDtos() {}

    public record QuoteLineRequest(
            @NotNull Long variantId,
            @Min(1) int quantity
    ) {}

    public record QuoteRequest(
            @NotEmpty List<@Valid QuoteLineRequest> items,
            String fulfillment
    ) {}

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
        public QuoteDto(List<QuoteLineDto> lines, BigDecimal subtotal, BigDecimal shippingFee, BigDecimal total, boolean valid) {
            this(lines, subtotal, shippingFee, total, valid, 0, BigDecimal.ZERO);
        }
    }
}
