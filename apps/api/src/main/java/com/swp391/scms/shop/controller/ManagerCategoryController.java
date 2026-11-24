package com.swp391.scms.shop.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.shop.dto.ProductAdminDtos.CategoryAdminDto;
import com.swp391.scms.shop.dto.ProductAdminDtos.CategoryUpsertRequest;
import com.swp391.scms.shop.service.CategoryAdminService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API quản lý danh mục sản phẩm cho quản lý trung tâm (đã ngừng; bật qua app.shop.enabled).
 *
 * Mặc định tắt: module cửa hàng đã bị gỡ khỏi phạm vi đang chạy.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1/manager/product-categories")
@PreAuthorize("hasRole('CENTER_MANAGER')")
public class ManagerCategoryController {
    private final CategoryAdminService categories;
    private final MessageService messages;

    /** Constructor cho test: không có MessageService. */
    public ManagerCategoryController(CategoryAdminService categories) {
        this(categories, null);
    }

    /** Constructor chính: nhận CategoryAdminService và MessageService. */
    @Autowired
    public ManagerCategoryController(CategoryAdminService categories, MessageService messages) {
        this.categories = categories;
        this.messages = messages;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messages == null ? key : messages.getMessage(key);
    }

    /** GET: danh sách danh mục kèm số sản phẩm. */
    @GetMapping
    public ApiResponse<List<CategoryAdminDto>> list() {
        return ApiResponse.ok(msg("success.shop.categories"), categories.list());
    }

    /** POST: tạo danh mục mới. */
    @PostMapping
    public ResponseEntity<ApiResponse<CategoryAdminDto>> create(@Valid @RequestBody CategoryUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("success.shop.product_saved"), categories.create(request)));
    }

    /** PUT /{id}: cập nhật danh mục. */
    @PutMapping("/{id}")
    public ApiResponse<CategoryAdminDto> update(@PathVariable Long id, @Valid @RequestBody CategoryUpsertRequest request) {
        return ApiResponse.ok(msg("success.shop.product_saved"), categories.update(id, request));
    }

    /** DELETE /{id}: xóa danh mục (trả 204). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categories.delete(id);
        return ResponseEntity.noContent().build();
    }
}
