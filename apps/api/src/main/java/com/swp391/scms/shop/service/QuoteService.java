package com.swp391.scms.shop.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.shop.dto.QuoteDtos.*;
import com.swp391.scms.shop.entity.Product;
import com.swp391.scms.shop.entity.ProductVariant;
import com.swp391.scms.shop.mapper.ProductMapper;
import com.swp391.scms.shop.repository.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class QuoteService {
    public static final int MAX_LINES = 30;
    public static final int MAX_LINE_QUANTITY = 20;
    public static final BigDecimal MAX_ORDER_TOTAL = new BigDecimal("100000000");

    public record PricedLine(ProductVariant variant, int quantity, BigDecimal lineTotal, String problem) {}
    /** {@code subtotal} is the list price of the lines; {@code total = subtotal - discountAmount + shippingFee}. */
    public record Priced(List<PricedLine> lines, BigDecimal subtotal, BigDecimal shippingFee, BigDecimal total, boolean valid,
                         int discountPercent, BigDecimal discountAmount) {
        public Priced(List<PricedLine> lines, BigDecimal subtotal, BigDecimal shippingFee, BigDecimal total, boolean valid) {
            this(lines, subtotal, shippingFee, total, valid, 0, BigDecimal.ZERO);
        }
    }

    private final ProductVariantRepository variants;
    private final ShopPricing pricing;

    public QuoteService(ProductVariantRepository variants, ShopPricing pricing) {
        this.variants = variants;
        this.pricing = pricing;
    }

    public static LinkedHashMap<Long, Integer> merge(List<QuoteLineRequest> items) {
        if (items == null || items.isEmpty()) {
            throw new BadRequestException("CART_EMPTY", "error.shop.cart_empty", null, "Cart is empty");
        }
        LinkedHashMap<Long, Integer> merged = new LinkedHashMap<>();
        for (QuoteLineRequest item : items) {
            if (item == null || item.variantId() == null || item.quantity() < 1) {
                throw new BadRequestException("CART_EMPTY", "error.shop.cart_empty", null, "Invalid cart line");
            }
            int nextQty = merged.getOrDefault(item.variantId(), 0) + item.quantity();
            if (nextQty > MAX_LINE_QUANTITY) {
                throw new BadRequestException("CART_TOO_LARGE", "error.shop.cart_too_large", null, "Line quantity exceeds 20");
            }
            merged.put(item.variantId(), nextQty);
        }
        if (merged.size() > MAX_LINES) {
            throw new BadRequestException("CART_TOO_LARGE", "error.shop.cart_too_large", null, "Cart exceeds 30 lines");
        }
        return merged;
    }

    public QuoteDto quote(QuoteRequest request) {
        return quote(request, 0);
    }

    /** Quote with the shopper's tier discount applied to the products (shipping is never discounted). */
    public QuoteDto quote(QuoteRequest request, int discountPercent) {
        if (request == null) {
            throw new BadRequestException("CART_EMPTY", "error.shop.cart_empty", null, "Cart is empty");
        }
        String fulfillment = (request.fulfillment() == null || request.fulfillment().isBlank())
                ? "pickup"
                : request.fulfillment().trim();
        LinkedHashMap<Long, Integer> merged = merge(request.items());
        List<ProductVariant> loaded = variants.findAllById(merged.keySet());
        return buildQuote(merged, loaded, fulfillment, discountPercent);
    }

    public Priced price(List<QuoteLineRequest> items, List<ProductVariant> lockedVariants, String fulfillment) {
        return price(items, lockedVariants, fulfillment, 0);
    }

    public Priced price(List<QuoteLineRequest> items, List<ProductVariant> lockedVariants, String fulfillment,
                        int discountPercent) {
        LinkedHashMap<Long, Integer> merged = merge(items);
        Map<Long, ProductVariant> byId = new HashMap<>();
        if (lockedVariants != null) {
            for (ProductVariant v : lockedVariants) {
                if (v != null && v.getId() != null) {
                    byId.put(v.getId(), v);
                }
            }
        }
        List<PricedLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        boolean valid = true;

        for (Map.Entry<Long, Integer> entry : merged.entrySet()) {
            Long variantId = entry.getKey();
            int requested = entry.getValue();
            ProductVariant v = byId.get(variantId);

            if (v == null) {
                lines.add(new PricedLine(null, 0, BigDecimal.ZERO, "NOT_FOUND"));
                valid = false;
                continue;
            }
            Product p = v.getProduct();
            boolean active = v.isActive()
                    && p != null
                    && p.isActive()
                    && (p.getCategory() == null || p.getCategory().isActive());
            if (!active) {
                lines.add(new PricedLine(v, 0, BigDecimal.ZERO, "INACTIVE"));
                valid = false;
                continue;
            }
            if (v.getStock() <= 0) {
                lines.add(new PricedLine(v, 0, BigDecimal.ZERO, "OUT_OF_STOCK"));
                valid = false;
                continue;
            }
            int actualQty = Math.min(requested, v.getStock());
            String problem = actualQty < requested ? "INSUFFICIENT_STOCK" : null;
            if (problem != null) {
                valid = false;
            }
            BigDecimal unitPrice = v.getPrice().setScale(0, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(actualQty));
            subtotal = subtotal.add(lineTotal);
            lines.add(new PricedLine(v, actualQty, lineTotal, problem));
        }

        if (subtotal.compareTo(MAX_ORDER_TOTAL) > 0) {
            throw new BadRequestException("CART_TOO_LARGE", "error.shop.cart_too_large", null, "Order exceeds maximum total");
        }
        // Free shipping is judged on the list price so a member discount never costs the shipping perk.
        BigDecimal shippingFee = pricing.shippingFee(fulfillment, subtotal);
        BigDecimal discount = com.swp391.scms.membership.service.MemberDiscountService.discountOf(subtotal, discountPercent);
        BigDecimal total = subtotal.subtract(discount).add(shippingFee);
        if (total.compareTo(MAX_ORDER_TOTAL) > 0) {
            throw new BadRequestException("CART_TOO_LARGE", "error.shop.cart_too_large", null, "Order exceeds maximum total");
        }
        return new Priced(List.copyOf(lines), subtotal, shippingFee, total, valid, Math.max(0, discountPercent), discount);
    }

    private QuoteDto buildQuote(LinkedHashMap<Long, Integer> merged, List<ProductVariant> loaded, String fulfillment,
                                int discountPercent) {
        List<QuoteLineRequest> normalizedRequests = merged.entrySet().stream()
                .map(e -> new QuoteLineRequest(e.getKey(), e.getValue()))
                .toList();
        Priced priced = price(normalizedRequests, loaded, fulfillment, discountPercent);

        List<QuoteLineDto> dtoLines = new ArrayList<>();
        int index = 0;
        for (Map.Entry<Long, Integer> entry : merged.entrySet()) {
            Long variantId = entry.getKey();
            int requested = entry.getValue();
            PricedLine pl = priced.lines().get(index++);
            ProductVariant v = pl.variant();
            Product p = v == null ? null : v.getProduct();
            BigDecimal unitPrice = v == null || v.getPrice() == null
                    ? BigDecimal.ZERO
                    : v.getPrice().setScale(0, RoundingMode.HALF_UP);
            int publicStock = v == null ? 0 : Math.min(Math.max(0, v.getStock()), ProductMapper.PUBLIC_STOCK_CAP);
            dtoLines.add(new QuoteLineDto(
                    variantId,
                    p == null ? null : p.getName(),
                    v == null ? null : v.getLabel(),
                    p == null ? null : p.getSlug(),
                    ProductMapper.firstImageUrl(p),
                    unitPrice,
                    requested,
                    pl.quantity(),
                    publicStock,
                    pl.lineTotal(),
                    pl.problem()
            ));
        }
        return new QuoteDto(List.copyOf(dtoLines), priced.subtotal(), priced.shippingFee(), priced.total(), priced.valid(),
                priced.discountPercent(), priced.discountAmount());
    }
}
