package com.swp391.scms.shop.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.common.image.ImageDataUrlValidator;
import com.swp391.scms.shop.dto.ProductPublicDtos.*;
import com.swp391.scms.shop.dto.QuoteDtos.QuoteDto;
import com.swp391.scms.shop.dto.QuoteDtos.QuoteRequest;
import com.swp391.scms.shop.entity.ProductGoal;
import com.swp391.scms.shop.entity.ProductImage;
import com.swp391.scms.shop.service.ProductCatalogService;
import com.swp391.scms.shop.service.QuoteService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * API shop công khai: danh mục, sản phẩm, ảnh, cấu hình và báo giá giỏ hàng (đã ngừng; bật qua
 * app.shop.enabled).
 *
 * Mặc định tắt: module cửa hàng đã bị gỡ khỏi phạm vi đang chạy.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1/public")
public class PublicProductController {
    private final ProductCatalogService catalog;
    private final QuoteService quotes;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.membership.service.MemberDiscountService discounts;
    private final MessageService messages;

    /** Constructor cho test: không có MessageService. */
    public PublicProductController(ProductCatalogService catalog, QuoteService quotes) {
        this(catalog, quotes, null);
    }

    /** Constructor chính: nhận service danh mục sản phẩm, báo giá và MessageService. */
    @Autowired
    public PublicProductController(ProductCatalogService catalog, QuoteService quotes, MessageService messages) {
        this.catalog = catalog;
        this.quotes = quotes;
        this.messages = messages;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messages == null ? key : messages.getMessage(key);
    }

    /** GET /product-categories: danh mục đang hoạt động. */
    @GetMapping("/product-categories")
    public ApiResponse<List<CategoryDto>> categories() {
        return ApiResponse.ok(msg("success.shop.categories"), catalog.categories());
    }

    /** GET /products: tìm sản phẩm theo từ khóa, mục tiêu, danh mục, còn hàng và sắp xếp; phân trang. */
    @GetMapping("/products")
    public ApiResponse<Page<ProductSummaryDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ProductGoal goal,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean inStock,
            @RequestParam(defaultValue = "false") boolean featuredFirst,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return ApiResponse.ok(
                msg("success.shop.products"),
                catalog.list(q, goal, category, inStock, featuredFirst, sort, page, size)
        );
    }

    /** GET /products/{slug}: chi tiết sản phẩm kèm sản phẩm liên quan. */
    @GetMapping("/products/{slug}")
    public ApiResponse<ProductDetailDto> detail(@PathVariable String slug) {
        return ApiResponse.ok(msg("success.shop.product"), catalog.detail(slug));
    }

    /**
     * GET /products/images/{imageId}: kiểm tra và giải mã data URL của ảnh (tối đa 2MB) rồi trả nội dung kèm
     * ETag và cache công khai 1 ngày.
     */
    @GetMapping("/products/images/{imageId}")
    public ResponseEntity<byte[]> image(@PathVariable Long imageId) {
        ProductImage img = catalog.image(imageId);
        var validated = ImageDataUrlValidator.validate(img.getDataUrl(), 2_000_000L);
        long epoch = img.getCreatedAt() == null ? 0L : img.getCreatedAt().toEpochSecond(ZoneOffset.UTC);
        String etag = "\"" + img.getId() + "-" + epoch + "\"";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(validated.contentType()))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .eTag(etag)
                .body(validated.bytes());
    }

    /** GET /shop/config: cấu hình shop cho client. */
    @GetMapping("/shop/config")
    public ApiResponse<ShopConfigDto> config() {
        return ApiResponse.ok(msg("success.shop.config"), catalog.config());
    }

    /** POST /shop/quote: báo giá giỏ hàng (áp giảm giá thành viên nếu đã đăng nhập). */
    @PostMapping("/shop/quote")
    public ApiResponse<QuoteDto> quote(@Valid @RequestBody QuoteRequest request,
                                       @org.springframework.security.core.annotation.AuthenticationPrincipal
                                       com.swp391.scms.security.AuthenticatedPrincipal principal) {
        int discount = principal != null && "MEMBER".equals(principal.role()) && discounts != null
                ? discounts.percentFor(principal.id()) : 0;
        return ApiResponse.ok(msg("success.shop.quote"), quotes.quote(request, discount));
    }
}
