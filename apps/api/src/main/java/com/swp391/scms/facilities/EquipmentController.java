package com.swp391.scms.facilities;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.dto.EquipmentDto;
import com.swp391.scms.facilities.dto.EquipmentRequest;
import com.swp391.scms.facilities.service.EquipmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** API thiết bị (tính năng đã ngừng, chỉ bật khi app.legacy.equipment-enabled=true). */
@Tag(name = "Equipment", description = "Gym equipment & machinery management")
@RestController
@ConditionalOnProperty(name = "app.legacy.equipment-enabled", havingValue = "true")
@RequestMapping("/api/v1/equipment")
public class EquipmentController {

    private final EquipmentService service;
    private final MessageService messageService;

    /** Nhận dịch vụ thiết bị và MessageService. */
    public EquipmentController(EquipmentService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET: danh sách thiết bị, lọc theo phòng. */
    @Operation(summary = "List all equipment or filter by room")
    @GetMapping
    public ApiResponse<List<EquipmentDto>> list(@RequestParam(required = false) Long roomId) {
        return ApiResponse.ok(msg("equipment.list"), service.list(roomId));
    }

    /** GET /{id}: chi tiết thiết bị. */
    @Operation(summary = "Get equipment details")
    @GetMapping("/{id}")
    public ApiResponse<EquipmentDto> get(@PathVariable Long id) {
        return ApiResponse.ok(msg("equipment.get"), service.get(id));
    }

    /** POST: thêm thiết bị (HTTP 201). */
    @Operation(summary = "Create equipment")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    @PostMapping
    public ResponseEntity<ApiResponse<EquipmentDto>> create(@Valid @RequestBody EquipmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("equipment.created"), service.create(request)));
    }

    /** PUT /{id}: sửa thiết bị. */
    @Operation(summary = "Update equipment")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    @PutMapping("/{id}")
    public ApiResponse<EquipmentDto> update(@PathVariable Long id, @Valid @RequestBody EquipmentRequest request) {
        return ApiResponse.ok(msg("equipment.updated"), service.update(id, request));
    }

    /** PATCH /{id}/status: đổi trạng thái thiết bị (active, maintenance, broken, retired). */
    @Operation(summary = "Quick update equipment status")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER', 'STAFF', 'RECEPTIONIST')")
    @PatchMapping("/{id}/status")
    public ApiResponse<EquipmentDto> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body != null ? body.get("status") : null;
        return ApiResponse.ok(msg("equipment.status_updated"), service.updateStatus(id, status));
    }

    /** DELETE /{id}: xóa thiết bị. */
    @Operation(summary = "Delete equipment")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok(msg("equipment.deleted"), null);
    }
}

