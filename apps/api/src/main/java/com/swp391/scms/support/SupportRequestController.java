package com.swp391.scms.support;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Support", description = "Quản lý các yêu cầu khiếu nại, hỗ trợ (Tickets)")
@RestController
@RequestMapping("/api/v1/support/requests")
public class SupportRequestController {

    private final SupportRequestService supportRequestService;
    private final MessageService messageService;

    public SupportRequestController(SupportRequestService supportRequestService, MessageService messageService) {
        this.supportRequestService = supportRequestService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Tạo yêu cầu hỗ trợ mới (Member)")
    @PostMapping
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<SupportRequestDto> createRequest(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CreateSupportRequestDto request) {
        SupportRequestDto result = supportRequestService.createRequest(principal.id(), request);
        return ApiResponse.ok(msg("support.create.success"), result);
    }

    @Operation(summary = "Xem lịch sử yêu cầu của bản thân (Member)")
    @GetMapping("/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Page<SupportRequestDto>> getMyRequests(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SupportRequestDto> requests = supportRequestService.getMyRequests(principal.id(), pageable);
        return ApiResponse.ok(msg("support.list.success"), requests);
    }

    @Operation(summary = "Xem toàn bộ yêu cầu, lọc theo status (Manager/Receptionist)")
    @GetMapping
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<Page<SupportRequestDto>> getAllRequests(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SupportRequestDto> requests = supportRequestService.getAllRequests(status, pageable);
        return ApiResponse.ok(msg("support.list.success"), requests);
    }

    @Operation(summary = "Cập nhật trạng thái và người phụ trách yêu cầu (Manager/Receptionist)")
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<SupportRequestDto> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSupportRequestStatusDto request) {
        SupportRequestDto result = supportRequestService.updateStatus(id, request);
        return ApiResponse.ok(msg("support.update_status.success"), result);
    }
}

