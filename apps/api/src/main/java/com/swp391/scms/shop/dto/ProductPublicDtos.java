package com.swp391.scms.shop.dto;

import com.swp391.scms.shop.entity.ProductGoal;

import java.math.BigDecimal;
import java.util.List;

/** Nhóm các DTO cho trang shop công khai. */
public final class ProductPublicDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private ProductPublicDtos() {}

    /** Danh mục công khai: id, tên và slug. */
    public record CategoryDto(Long id, String name, String slug) {}

    /** Chỉ số dinh dưỡng nổi bật hiển thị trên thẻ sản phẩm: tên, lượng và đơn vị. */
    public record HighlightDto(String name, BigDecimal amount, String unit) {}

    /**
     * Thẻ sản phẩm trong danh sách: danh mục, dạng, mục tiêu, mô tả ngắn, ảnh, chỉ số nổi bật, giá, tình trạng
     * hàng, nổi bật, hàng mới, biến thể mặc định và số biến thể.
     */
    public record ProductSummaryDto(
            Long id,
            String slug,
            String name,
            String categoryName,
            String form,
            List<ProductGoal> goals,
            String shortDescription,
            String imageUrl,
            HighlightDto highlight,
            BigDecimal minPrice,
            BigDecimal pricePerServing,
            boolean inStock,
            boolean lowStock,
            boolean featured,
            boolean isNew,
            Long defaultVariantId,
            int variantCount
    ) {
        /** Constructor rút gọn không có biến thể mặc định và số biến thể. */
        public ProductSummaryDto(
                Long id,
                String slug,
                String name,
                String categoryName,
                String form,
                List<ProductGoal> goals,
                String shortDescription,
                String imageUrl,
                HighlightDto highlight,
                BigDecimal minPrice,
                BigDecimal pricePerServing,
                boolean inStock,
                boolean lowStock,
                boolean featured,
                boolean isNew
        ) {
            this(id, slug, name, categoryName, form, goals, shortDescription, imageUrl, highlight,
                    minPrice, pricePerServing, inStock, lowStock, featured, isNew, null, 0);
        }
    }

    /** Ảnh sản phẩm công khai: id, URL và mô tả. */
    public record ImageDto(Long id, String url, String alt) {}

    /** Biến thể công khai: SKU, nhãn, giá, số khẩu phần, giá mỗi khẩu phần, tồn kho và còn bán không. */
    public record VariantDto(
            Long id,
            String sku,
            String label,
            BigDecimal price,
            Integer servingsPerContainer,
            BigDecimal pricePerServing,
            int stock,
            boolean available
    ) {}

    /** Một dòng dinh dưỡng công khai: tên, lượng, đơn vị, % nhu cầu, dòng con và có nổi bật không. */
    public record NutrientDto(
            String name,
            BigDecimal amount,
            String unit,
            Integer dailyValuePercent,
            boolean subRow,
            boolean highlight
    ) {}

    /**
     * Chi tiết sản phẩm công khai: mô tả, danh mục, dạng, mục tiêu, khẩu phần, hướng dẫn, cảnh báo, số đăng ký,
     * ảnh, biến thể, dinh dưỡng và sản phẩm liên quan.
     */
    public record ProductDetailDto(
            Long id,
            String slug,
            String name,
            String brand,
            String categoryName,
            String categorySlug,
            String form,
            List<ProductGoal> goals,
            String shortDescription,
            String description,
            String servingSize,
            String usageInstructions,
            String warnings,
            String registrationNumber,
            List<ImageDto> images,
            List<VariantDto> variants,
            List<NutrientDto> nutrients,
            List<ProductSummaryDto> related
    ) {}

    /**
     * Cấu hình shop gửi cho client: phí ship, ngưỡng miễn phí ship, thời gian chờ thanh toán, thời gian giữ
     * hàng tại quầy và địa chỉ nhận.
     */
    public record ShopConfigDto(
            BigDecimal shippingFee,
            BigDecimal freeShippingThreshold,
            int paymentWindowMinutes,
            int counterHoldHours,
            String pickupAddress
    ) {}
}
