package com.swp391.scms.shop.dto;

import com.swp391.scms.shop.dto.ProductPublicDtos.ImageDto;
import com.swp391.scms.shop.dto.ProductPublicDtos.NutrientDto;
import com.swp391.scms.shop.entity.ProductGoal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/** Nhóm các DTO cho màn quản lý sản phẩm của quản lý. */
public final class ProductAdminDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private ProductAdminDtos() {}

    /** Yêu cầu tạo/sửa danh mục: tên, thứ tự hiển thị và trạng thái. */
    public record CategoryUpsertRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            int sortOrder,
            boolean active
    ) {}

    /** Thông tin danh mục cho quản lý kèm số sản phẩm. */
    public record CategoryAdminDto(
            Long id,
            String name,
            String slug,
            int sortOrder,
            boolean active,
            long productCount
    ) {}

    /**
     * Tóm tắt sản phẩm cho quản lý: danh mục, số biến thể, tổng tồn, sắp hết hàng, trạng thái, nổi bật, ảnh,
     * giá thấp nhất và có phải hàng mới không.
     */
    public record ProductAdminSummaryDto(
            Long id,
            String name,
            String slug,
            String categoryName,
            int variantCount,
            int totalStock,
            boolean lowStock,
            boolean active,
            boolean featured,
            String imageUrl,
            BigDecimal minPrice,
            boolean isNew
    ) {
        /** Constructor rút gọn không có giá thấp nhất và cờ hàng mới. */
        public ProductAdminSummaryDto(
                Long id,
                String name,
                String slug,
                String categoryName,
                int variantCount,
                int totalStock,
                boolean lowStock,
                boolean active,
                boolean featured,
                String imageUrl
        ) {
            this(id, name, slug, categoryName, variantCount, totalStock, lowStock, active, featured, imageUrl, null, false);
        }
    }

    /**
     * Thông tin biến thể cho quản lý: SKU, nhãn, giá, số khẩu phần, giá mỗi khẩu phần, tồn kho, trạng thái và
     * thứ tự.
     */
    public record VariantAdminDto(
            Long id,
            String sku,
            String label,
            BigDecimal price,
            Integer servingsPerContainer,
            BigDecimal pricePerServing,
            int stock,
            boolean active,
            int sortOrder
    ) {}

    /**
     * Chi tiết sản phẩm cho quản lý: thông tin mô tả, danh mục, dạng, mục tiêu, số đăng ký, trạng thái, ảnh,
     * biến thể và thành phần dinh dưỡng.
     */
    public record ProductAdminDto(
            Long id,
            String slug,
            String name,
            String brand,
            Long categoryId,
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
            boolean active,
            boolean featured,
            List<ImageDto> images,
            List<VariantAdminDto> variants,
            List<NutrientDto> nutrients
    ) {}

    /**
     * Yêu cầu tạo/sửa biến thể: SKU (A-Z, 0-9, -), nhãn, giá 1.000–100.000.000, số khẩu phần, tồn ban đầu,
     * trạng thái và thứ tự.
     */
    public record VariantUpsertRequest(
            Long id,
            @NotBlank @Pattern(regexp = "^[A-Z0-9-]{3,40}$") String sku,
            @NotBlank @Size(min = 1, max = 80) String label,
            @NotNull @DecimalMin("1000") @DecimalMax("100000000") BigDecimal price,
            @Min(1) @Max(1000) Integer servingsPerContainer,
            @Min(0) @Max(9999) Integer initialStock,
            boolean active,
            int sortOrder
    ) {}

    /** Yêu cầu tạo/sửa một dòng dinh dưỡng: tên, lượng, đơn vị, % nhu cầu, dòng con, có nổi bật không và thứ tự. */
    public record NutrientUpsertRequest(
            @NotBlank @Size(min = 1, max = 80) String name,
            @NotNull @DecimalMin("0") @DecimalMax("100000") BigDecimal amount,
            @NotBlank @Size(min = 1, max = 12) String unit,
            @Min(0) @Max(1000) Integer dailyValuePercent,
            boolean subRow,
            boolean highlight,
            int sortOrder
    ) {}

    /**
     * Yêu cầu tạo/sửa sản phẩm: tên, danh mục, dạng, thương hiệu, mô tả, khẩu phần, hướng dẫn, cảnh báo, số
     * đăng ký, mục tiêu, trạng thái, nổi bật, biến thể và dinh dưỡng.
     */
    public record ProductUpsertRequest(
            @NotBlank @Size(min = 2, max = 160) String name,
            @NotNull Long categoryId,
            @NotBlank String form,
            @Size(max = 80) String brand,
            @NotBlank @Size(min = 10, max = 300) String shortDescription,
            @Size(max = 5000) String description,
            @NotBlank @Size(min = 1, max = 60) String servingSize,
            @Size(max = 2000) String usageInstructions,
            @Size(max = 2000) String warnings,
            @Size(max = 60) String registrationNumber,
            @NotEmpty Set<ProductGoal> goals,
            boolean active,
            boolean featured,
            @NotEmpty @Size(min = 1, max = 12) List<@Valid VariantUpsertRequest> variants,
            @Size(max = 30) List<@Valid NutrientUpsertRequest> nutrients
    ) {}

    /** Yêu cầu bật/tắt hoạt động. */
    public record SetActiveRequest(boolean active) {}

    /** Yêu cầu tải ảnh: data URL và mô tả ảnh. */
    public record ImageUploadRequest(
            @NotBlank String dataUrl,
            @NotBlank @Size(min = 1, max = 160) String altText
    ) {}

    /** Yêu cầu sắp xếp lại ảnh: danh sách id ảnh theo thứ tự mới. */
    public record ImageOrderRequest(
            @NotEmpty List<Long> imageIds
    ) {}

    /** Yêu cầu điều chỉnh tồn kho: số lượng tăng/giảm, lý do và ghi chú. */
    public record StockAdjustmentRequest(
            int delta,
            @NotBlank String reason,
            @Size(max = 200) String note
    ) {}

    /** Số liệu tổng quan cho quản lý: đơn chờ xử lý, doanh thu 30 ngày và số biến thể sắp hết hàng. */
    public record ManagerOrderSummaryDto(
            long pendingFulfillment,
            BigDecimal revenue30d,
            long lowStockVariants
    ) {}
}
