package com.swp391.scms.shop.mapper;

import com.swp391.scms.shop.dto.ProductPublicDtos.*;
import com.swp391.scms.shop.entity.Product;
import com.swp391.scms.shop.entity.ProductImage;
import com.swp391.scms.shop.entity.ProductNutrient;
import com.swp391.scms.shop.entity.ProductVariant;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Các hàm static chuyển entity sản phẩm sang DTO công khai; giới hạn tồn hiển thị, ngưỡng sắp hết hàng và số
 * ngày coi là hàng mới.
 */
public final class ProductMapper {
    public static final int PUBLIC_STOCK_CAP = 99;
    public static final int LOW_STOCK_THRESHOLD = 9;
    public static final int NEW_PRODUCT_DAYS = 2;

    /** Constructor private: lớp tiện ích chỉ có hàm static. */
    private ProductMapper() {}

    /**
     * URL công khai của ảnh sản phẩm, kèm tham số phiên bản theo thời điểm tạo để trình duyệt không dùng cache
     * cũ.
     */
    public static String imageUrl(ProductImage image) {
        if (image == null || image.getId() == null) {
            return null;
        }
        long v = image.getCreatedAt() == null ? 0L : image.getCreatedAt().toEpochSecond(ZoneOffset.UTC);
        return "/api/v1/public/products/images/" + image.getId() + "?v=" + v;
    }

    /** URL ảnh đầu tiên của sản phẩm, không có ảnh thì null. */
    public static String firstImageUrl(Product product) {
        if (product == null || product.getImages() == null || product.getImages().isEmpty()) {
            return null;
        }
        return imageUrl(product.getImages().getFirst());
    }

    /**
     * Chuyển sản phẩm sang thẻ danh sách: chỉ tính biến thể đang bán, tính còn hàng, sắp hết hàng, giá thấp
     * nhất, giá mỗi khẩu phần, chỉ số nổi bật và hàng mới.
     */
    public static ProductSummaryDto toSummary(Product product, LocalDateTime now) {
        List<ProductVariant> activeVariants = product.getVariants() == null
                ? List.of()
                : product.getVariants().stream().filter(ProductVariant::isActive).toList();

        int totalStock = activeVariants.stream().mapToInt(v -> Math.max(0, v.getStock())).sum();
        boolean inStock = activeVariants.stream().anyMatch(v -> v.getStock() > 0);
        boolean lowStock = totalStock > 0 && (totalStock <= LOW_STOCK_THRESHOLD
                || activeVariants.stream().anyMatch(v -> v.getStock() > 0 && v.getStock() <= LOW_STOCK_THRESHOLD));

        BigDecimal minPrice = activeVariants.stream()
                .map(ProductVariant::getPrice)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);

        BigDecimal pricePerServing = activeVariants.stream()
                .map(ProductVariant::pricePerServing)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);

        Long defaultVariantId = activeVariants.stream()
                .filter(v -> v.getStock() > 0)
                .findFirst()
                .or(() -> activeVariants.stream().findFirst())
                .map(ProductVariant::getId)
                .orElse(null);

        HighlightDto highlight = product.getNutrients() == null
                ? null
                : product.getNutrients().stream()
                        .filter(ProductNutrient::isHighlight)
                        .findFirst()
                        .map(n -> new HighlightDto(n.getName(), n.getAmount(), n.getUnit()))
                        .orElse(null);

        boolean isNew = product.getCreatedAt() != null
                && now != null
                && !product.getCreatedAt().isBefore(now.minusDays(NEW_PRODUCT_DAYS));

        return new ProductSummaryDto(
                product.getId(),
                product.getSlug(),
                product.getName(),
                product.getCategory() == null ? null : product.getCategory().getName(),
                product.getForm(),
                product.getGoals() == null ? List.of() : List.copyOf(product.getGoals()),
                product.getShortDescription(),
                firstImageUrl(product),
                highlight,
                minPrice,
                pricePerServing,
                inStock,
                lowStock,
                product.isFeatured(),
                isNew,
                defaultVariantId,
                activeVariants.size()
        );
    }

    /**
     * Chuyển biến thể sang DTO công khai: tồn kho bị giới hạn tối đa PUBLIC_STOCK_CAP, còn bán khi đang hoạt
     * động và tồn > 0.
     */
    public static VariantDto toPublicVariant(ProductVariant variant) {
        int cappedStock = Math.min(Math.max(0, variant.getStock()), PUBLIC_STOCK_CAP);
        boolean available = variant.isActive() && variant.getStock() > 0;
        return new VariantDto(
                variant.getId(),
                variant.getSku(),
                variant.getLabel(),
                variant.getPrice(),
                variant.getServingsPerContainer(),
                variant.pricePerServing(),
                cappedStock,
                available
        );
    }

    /**
     * Chuyển sản phẩm sang chi tiết công khai: ảnh, biến thể đang bán, thành phần dinh dưỡng và sản phẩm liên
     * quan.
     */
    public static ProductDetailDto toDetail(Product product, List<ProductSummaryDto> related) {
        List<ImageDto> images = product.getImages() == null
                ? List.of()
                : product.getImages().stream()
                        .map(i -> new ImageDto(i.getId(), imageUrl(i), i.getAltText()))
                        .toList();

        List<VariantDto> variants = product.getVariants() == null
                ? List.of()
                : product.getVariants().stream()
                        .filter(ProductVariant::isActive)
                        .map(ProductMapper::toPublicVariant)
                        .toList();

        List<NutrientDto> nutrients = product.getNutrients() == null
                ? List.of()
                : product.getNutrients().stream()
                        .map(n -> new NutrientDto(
                                n.getName(),
                                n.getAmount(),
                                n.getUnit(),
                                n.getDailyValuePercent(),
                                n.isSubRow(),
                                n.isHighlight()))
                        .toList();

        return new ProductDetailDto(
                product.getId(),
                product.getSlug(),
                product.getName(),
                product.getBrand(),
                product.getCategory() == null ? null : product.getCategory().getName(),
                product.getCategory() == null ? null : product.getCategory().getSlug(),
                product.getForm(),
                product.getGoals() == null ? List.of() : List.copyOf(product.getGoals()),
                product.getShortDescription(),
                product.getDescription(),
                product.getServingSize(),
                product.getUsageInstructions(),
                product.getWarnings(),
                product.getRegistrationNumber(),
                images,
                variants,
                nutrients,
                related == null ? List.of() : related
        );
    }
}
