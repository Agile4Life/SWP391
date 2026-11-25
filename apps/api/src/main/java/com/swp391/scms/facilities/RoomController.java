package com.swp391.scms.facilities;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.dto.CatalogRequests.RoomRequest;
import com.swp391.scms.facilities.dto.CatalogResponses.RoomDto;
import com.swp391.scms.facilities.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** API phòng tập (/api/v1/rooms): mọi người đăng nhập xem được, quản lý trung tâm thêm/sửa/xóa. */
@Tag(name = "Rooms", description = "Room catalog. Read: any authenticated user; write: CENTER_MANAGER")
@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {

    private final RoomService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public RoomController(RoomService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public RoomController(RoomService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET: danh sách phòng theo tên. */
    @Operation(summary = "List rooms")
    @GetMapping
    public ApiResponse<List<RoomDto>> list() {
        return ApiResponse.ok(msg("catalog.list"), service.list());
    }

    /** POST: tạo phòng mới (HTTP 201). */
    @Operation(summary = "Create room")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PostMapping
    public ResponseEntity<ApiResponse<RoomDto>> create(@Valid @RequestBody RoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(msg("catalog.created"), service.create(request)));
    }

    /** PUT /{id}: sửa phòng. */
    @Operation(summary = "Update room, including available/maintenance/closed status")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @PutMapping("/{id}")
    public ApiResponse<RoomDto> update(@PathVariable Long id, @Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok(msg("catalog.updated"), service.update(id, request));
    }

    /** DELETE /{id}: xóa phòng chưa từng được dùng. */
    @Operation(summary = "Delete an unused room")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok(msg("catalog.deleted"), null);
    }
}
