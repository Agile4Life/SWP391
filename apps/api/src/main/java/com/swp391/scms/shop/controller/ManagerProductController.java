package com.swp391.scms.shop.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.shop.dto.ProductAdminDtos.*;
import com.swp391.scms.shop.service.ProductAdminService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * API quản lý sản phẩm, ảnh, tồn kho và thống kê đơn cho quản lý trung tâm (đã ngừng; bật qua
 * app.shop.enabled).
 *
 * Disabled by default: Shop module removed from the active scope.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1/manager")
@PreAuthorize("hasRole('CENTER_MANAGER')")
public class ManagerProductController {
    private final ProductAdminService products;
    private final MessageService messages;

    /** Constructor cho test: không có MessageService. */
    public ManagerProductController(ProductAdminService products) {
        this(products, null);
    }

    /** Constructor chính: nhận ProductAdminService và MessageService. */
    @Autowired
    public ManagerProductController(ProductAdminService products, MessageService messages) {
        this.products = products;
        this.messages = messages;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messages == null ? key : messages.getMessage(key);
    }

    /** GET /products: tìm sản phẩm theo từ khóa, trạng thái, sắp hết hàng; phân trang. */
    @GetMapping("/products")
    public ApiResponse<Page<ProductAdminSummaryDto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean lowStock,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.ok(msg("success.shop.products"), products.list(q, active, lowStock, page, size));
    }

    /** GET /products/{id}: chi tiết sản phẩm cho quản lý. */
    @GetMapping("/products/{id}")
    public ApiResponse<ProductAdminDto> get(@PathVariable Long id) {
        return ApiResponse.ok(msg("success.shop.product"), products.get(id));
    }

    /** POST /products: tạo sản phẩm kèm biến thể và dinh dưỡng. */
    @PostMapping("/products")
    public ResponseEntity<ApiResponse<ProductAdminDto>> create(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody ProductUpsertRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("success.shop.product_saved"), products.create(principal, request)));
    }

    /** PUT /products/{id}: cập nhật sản phẩm. */
    @PutMapping("/products/{id}")
    public ApiResponse<ProductAdminDto> update(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody ProductUpsertRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.product_saved"), products.update(principal, id, request));
    }

    /** PATCH /products/{id}/active: bật/tắt bán sản phẩm. */
    @PatchMapping("/products/{id}/active")
    public ApiResponse<ProductAdminDto> setActive(
            @PathVariable Long id,
            @Valid @RequestBody SetActiveRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.product_saved"), products.setActive(id, request.active()));
    }

    /** DELETE /products/{id}: xóa sản phẩm (trả 204). */
    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        products.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** POST /products/{id}/images: tải thêm ảnh sản phẩm. */
    @PostMapping("/products/{id}/images")
    public ApiResponse<ProductAdminDto> addImage(
            @PathVariable Long id,
            @Valid @RequestBody ImageUploadRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.product_saved"), products.addImage(id, request));
    }

    /** DELETE /products/{id}/images/{imageId}: xóa một ảnh. */
    @DeleteMapping("/products/{id}/images/{imageId}")
    public ApiResponse<ProductAdminDto> removeImage(
            @PathVariable Long id,
            @PathVariable Long imageId
    ) {
        return ApiResponse.ok(msg("success.shop.product_saved"), products.removeImage(id, imageId));
    }

    /** PUT /products/{id}/images/order: sắp xếp lại thứ tự ảnh. */
    @PutMapping("/products/{id}/images/order")
    public ApiResponse<ProductAdminDto> reorderImages(
            @PathVariable Long id,
            @Valid @RequestBody ImageOrderRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.product_saved"), products.reorderImages(id, request.imageIds()));
    }

    /** POST /product-variants/{id}/stock-adjustments: điều chỉnh tồn kho biến thể. */
    @PostMapping("/product-variants/{id}/stock-adjustments")
    public ApiResponse<VariantAdminDto> adjustStock(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody StockAdjustmentRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.stock_adjusted"), products.adjustStock(principal, id, request));
    }

    /** GET /product-orders/summary: số đơn chờ xử lý, doanh thu 30 ngày và số biến thể sắp hết hàng. */
    @GetMapping("/product-orders/summary")
    public ApiResponse<ManagerOrderSummaryDto> summary() {
        return ApiResponse.ok(msg("success.shop.summary"), products.summary());
    }
}
