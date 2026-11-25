package com.swp391.scms.facilities;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageStatusRequest;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.service.PackageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** API gói tập (/api/v1/packages): mọi người đăng nhập xem được, quản lý trung tâm thêm/sửa/đổi trạng thái/xóa. */
@Tag(name = "Membership Packages", description = "Package catalog. Read: any authenticated user; write: CENTER_MANAGER")
@RestController
@RequestMapping("/api/v1/packages")
public class PackageController {

    private final PackageService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public PackageController(PackageService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public PackageController(PackageService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET: danh sách gói theo giá tăng dần. */
    @Operation(summary = "List membership packages")
    @GetMapping
    public ApiResponse<List<PackageDto>> list() {
        return ApiResponse.ok(msg("catalog.list"), service.list());
    }

    /** POST: tạo gói mới (HTTP 201). */
    @Operation(summary = "Create membership package")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PostMapping
    public ResponseEntity<ApiResponse<PackageDto>> create(@Valid @RequestBody PackageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(msg("catalog.created"), service.create(request)));
    }

    /** PUT /{id}: sửa gói (gói đã bán không được đổi tên hoặc thời hạn). */
    @Operation(summary = "Update membership package")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PutMapping("/{id}")
    public ApiResponse<PackageDto> update(@PathVariable Long id, @Valid @RequestBody PackageRequest request) {
        return ApiResponse.ok(msg("catalog.updated"), service.update(id, request));
    }

    /** PATCH /{id}/status: bật/tắt mở bán gói. */
    @Operation(summary = "Activate or deactivate a membership package")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PatchMapping("/{id}/status")
    public ApiResponse<PackageDto> updateStatus(@PathVariable Long id, @Valid @RequestBody PackageStatusRequest request) {
        return ApiResponse.ok(msg("catalog.updated"), service.updateStatus(id, request.status()));
    }

    /** DELETE /{id}: xóa gói chưa từng bán. */
    @Operation(summary = "Delete a package that was never sold")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok(msg("catalog.deleted"), null);
    }
}
