package com.swp391.scms.operations;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.operations.dto.StaffInternalRequestCreateDto;
import com.swp391.scms.operations.dto.StaffInternalRequestDto;
import com.swp391.scms.operations.dto.StaffInternalRequestReviewDto;
import com.swp391.scms.operations.service.StaffInternalRequestService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API đơn từ nội bộ của nhân viên (/api/v1/operations/requests): HLV/lễ tân gửi và hủy đơn (nghỉ phép, đổi
 * ca...), quản lý xem và duyệt.
 */
@Tag(name = "Internal Staff Requests", description = "Hệ thống đơn từ nội bộ giữa Nhân viên/HLV và Quản lý (SCRUM-135)")
@RestController
@RequestMapping("/api/v1/operations/requests")
public class StaffInternalRequestController {

    private final StaffInternalRequestService requestService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public StaffInternalRequestController(StaffInternalRequestService requestService) {
        this(requestService, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public StaffInternalRequestController(StaffInternalRequestService requestService, MessageService messageService) {
        this.requestService = requestService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: nhân viên gửi đơn mới (HTTP 201). */
    @Operation(summary = "Tạo đơn từ nội bộ mới", description = "Nhân viên lễ tân / HLV tạo đơn xin nghỉ phép, đổi ca hoặc đổi lịch dạy")
    @PreAuthorize("hasAnyRole('STAFF', 'COACH', 'RECEPTIONIST')")
    @PostMapping
    public ResponseEntity<ApiResponse<StaffInternalRequestDto>> createRequest(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody StaffInternalRequestCreateDto requestDto) {
        StaffInternalRequestDto created = requestService.createRequest(principal.id(), requestDto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("operations.request.create.success"), created));
    }

    /** GET /my: các đơn của chính nhân viên, lọc theo trạng thái. */
    @Operation(summary = "Xem danh sách đơn từ của tôi", description = "Nhân viên / HLV xem các đơn từ đã gửi của chính mình")
    @PreAuthorize("hasAnyRole('STAFF', 'COACH', 'RECEPTIONIST')")
    @GetMapping("/my")
    public ApiResponse<List<StaffInternalRequestDto>> getMyRequests(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(name = "status", required = false) String status) {
        List<StaffInternalRequestDto> list = requestService.getMyRequests(principal.id(), status);
        return ApiResponse.ok(msg("operations.request.list.success"), list);
    }

    /** PUT /{id}/cancel: nhân viên hủy đơn đang chờ duyệt. */
    @Operation(summary = "Hủy đơn từ đang chờ duyệt", description = "Nhân viên / HLV tự hủy đơn khi còn ở trạng thái PENDING")
    @PreAuthorize("hasAnyRole('STAFF', 'COACH', 'RECEPTIONIST')")
    @PutMapping("/{id}/cancel")
    public ApiResponse<StaffInternalRequestDto> cancelRequest(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id) {
        StaffInternalRequestDto cancelled = requestService.cancelRequest(principal.id(), id);
        return ApiResponse.ok(msg("operations.request.cancel.success"), cancelled);
    }

    /** GET: quản lý xem mọi đơn, lọc theo trạng thái và loại đơn. */
    @Operation(summary = "Quản lý xem danh sách đơn từ nội bộ", description = "Quản lý / Giám đốc xem tất cả đơn từ nhân viên gửi lên")
    @PreAuthorize("hasAnyRole('MANAGER', 'CENTER_MANAGER')")
    @GetMapping
    public ApiResponse<List<StaffInternalRequestDto>> getAllRequests(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "type", required = false) String requestType) {
        List<StaffInternalRequestDto> list = requestService.getAllRequests(status, requestType);
        return ApiResponse.ok(msg("operations.request.list.success"), list);
    }

    /** PUT /{id}/review: quản lý duyệt hoặc từ chối đơn (từ chối phải có lý do). */
    @Operation(summary = "Phê duyệt hoặc từ chối đơn từ", description = "Quản lý duyệt (APPROVED) hoặc từ chối (REJECTED) đơn từ")
    @PreAuthorize("hasAnyRole('MANAGER', 'CENTER_MANAGER')")
    @PutMapping("/{id}/review")
    public ApiResponse<StaffInternalRequestDto> reviewRequest(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id,
            @Valid @RequestBody StaffInternalRequestReviewDto reviewDto) {
        StaffInternalRequestDto reviewed = requestService.reviewRequest(principal.id(), id, reviewDto);
        return ApiResponse.ok(msg("operations.request.review.success"), reviewed);
    }
}

