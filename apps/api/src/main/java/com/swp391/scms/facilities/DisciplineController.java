package com.swp391.scms.facilities;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.dto.CatalogRequests.DisciplineRequest;
import com.swp391.scms.facilities.dto.CatalogResponses.DisciplineDto;
import com.swp391.scms.facilities.service.DisciplineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** API bộ môn (/api/v1/disciplines): mọi người đăng nhập xem được, quản lý trung tâm thêm/sửa/xóa. */
@Tag(name = "Disciplines", description = "Discipline catalog. Read: any authenticated user; write: CENTER_MANAGER")
@RestController
@RequestMapping("/api/v1/disciplines")
public class DisciplineController {

    private final DisciplineService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public DisciplineController(DisciplineService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public DisciplineController(DisciplineService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET: danh sách bộ môn theo tên. */
    @Operation(summary = "List disciplines")
    @GetMapping
    public ApiResponse<List<DisciplineDto>> list() {
        return ApiResponse.ok(msg("catalog.list"), service.list());
    }

    /** POST: tạo bộ môn mới (HTTP 201). */
    @Operation(summary = "Create discipline")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PostMapping
    public ResponseEntity<ApiResponse<DisciplineDto>> create(@Valid @RequestBody DisciplineRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(msg("catalog.created"), service.create(request)));
    }

    /** PUT /{id}: sửa bộ môn. */
    @Operation(summary = "Update discipline")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PutMapping("/{id}")
    public ApiResponse<DisciplineDto> update(@PathVariable Long id, @Valid @RequestBody DisciplineRequest request) {
        return ApiResponse.ok(msg("catalog.updated"), service.update(id, request));
    }

    /** DELETE /{id}: xóa bộ môn chưa được dùng. */
    @Operation(summary = "Delete an unused discipline")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok(msg("catalog.deleted"), null);
    }
}
