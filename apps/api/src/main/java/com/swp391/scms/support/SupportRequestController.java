package com.swp391.scms.support;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.support.dto.CreateSupportMessageDto;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.EscalateSupportRequestDto;
import com.swp391.scms.support.dto.MarkSupportReadDto;
import com.swp391.scms.support.dto.SupportReadResultDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestMessageDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API khiếu nại/yêu cầu hỗ trợ (/api/v1/support/requests): hội viên gửi phiếu và nhắn tin; lễ tân xử lý, chuyển
 * lên quản lý khi cần; quản lý xử lý phiếu đã được chuyển lên.
 */
@Tag(name = "Support", description = "Quản lý các yêu cầu khiếu nại, hỗ trợ (Tickets)")
@RestController
@RequestMapping("/api/v1/support/requests")
public class SupportRequestController {

    private final SupportRequestService supportRequestService;
    private final MessageService messageService;
    private final SupportInboxService inboxService;

    /** Constructor cho test, không có MessageService. */
    public SupportRequestController(SupportRequestService supportRequestService) {
        this(supportRequestService, null);
    }

    /** Constructor Spring dùng. */
    public SupportRequestController(SupportRequestService supportRequestService, MessageService messageService) {
        this(supportRequestService, messageService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SupportRequestController(SupportRequestService supportRequestService, MessageService messageService,
                                    SupportInboxService inboxService) {
        this.inboxService = inboxService;
        this.supportRequestService = supportRequestService;
        this.messageService = messageService;
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'CENTER_MANAGER')")
    public ApiResponse<SupportReadResultDto> markRead(@PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody MarkSupportReadDto request) {
        return ApiResponse.ok(msg("support.read.success"),
                inboxService.markRead(id, principal.id(), principal.role(), request.lastMessageId()));
    }

    /** GET /{id}: chi tiết phiếu (hội viên chủ phiếu hoặc nhân viên được xem). */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER')")
    public ApiResponse<SupportRequestDto> getRequest(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("support.list.success"), supportRequestService.getRequest(id, principal.id(), principal.role()));
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: hội viên gửi phiếu mới. */
    @Operation(summary = "Tạo yêu cầu hỗ trợ mới (Member)")
    @PostMapping
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<SupportRequestDto> createRequest(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CreateSupportRequestDto request) {
        SupportRequestDto result = supportRequestService.createRequest(principal.id(), request);
        return ApiResponse.ok(msg("support.create.success"), result);
    }

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;

    /** Cố định sắp xếp mới nhất trước và giới hạn kích thước trang (1..50), bỏ sort tùy ý từ client. */
    private static Pageable sanitizePageable(Pageable pageable) {
        int page = pageable != null && pageable.isPaged() ? Math.max(0, pageable.getPageNumber()) : 0;
        int size = pageable != null && pageable.isPaged() ? pageable.getPageSize() : DEFAULT_PAGE_SIZE;
        size = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    /** GET /my: các phiếu của hội viên, có phân trang. */
    @Operation(summary = "Xem lịch sử yêu cầu của bản thân (Member)")
    @GetMapping("/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Page<SupportRequestDto>> getMyRequests(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SupportRequestDto> requests = supportRequestService.getMyRequests(principal.id(), sanitizePageable(pageable));
        return ApiResponse.ok(msg("support.list.success"), requests);
    }

    /** GET: hộp thư phiếu cho nhân viên, lọc theo trạng thái (quản lý chỉ thấy phiếu đã chuyển lên). */
    @Operation(summary = "Hộp thư khiếu nại: lễ tân thấy toàn bộ, quản lý chỉ thấy phần đã chuyển lên")
    @GetMapping
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<Page<SupportRequestDto>> getAllRequests(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SupportRequestDto> requests = ("RECEPTIONIST".equals(principal.role()) || "CENTER_MANAGER".equals(principal.role())) && inboxService != null
                ? inboxService.inbox(principal.id(), principal.role(), status, unreadOnly, sanitizePageable(pageable))
                : supportRequestService.getAllRequests(status, sanitizePageable(pageable), principal.role());
        return ApiResponse.ok(msg("support.list.success"), requests);
    }

    /** Tương thích các caller Java cũ; HTTP dùng bản có unreadOnly. */
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<Page<SupportRequestDto>> getAllRequests(AuthenticatedPrincipal principal,
                                                              String status, Pageable pageable) {
        return getAllRequests(principal, status, false, pageable);
    }

    /** PATCH /{id}/status: đổi trạng thái hoặc người phụ trách phiếu. */
    @Operation(summary = "Cập nhật trạng thái và người phụ trách (lễ tân trước khi chuyển cấp, quản lý sau khi được chuyển lên)")
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<SupportRequestDto> updateStatus(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateSupportRequestStatusDto request) {
        SupportRequestDto result = supportRequestService.updateStatus(id, request, principal.id(), principal.role());
        return ApiResponse.ok(msg("support.update_status.success"), result);
    }

    /** POST /{id}/close: hội viên đóng phiếu (rút phiếu đang mở hoặc xác nhận phiếu đã giải quyết). */
    @Operation(summary = "Hội viên rút phiếu đang mở hoặc xác nhận phiếu đã giải quyết (đóng phiếu)")
    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<SupportRequestDto> close(@AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long id) {
        return ApiResponse.ok(msg("support.close.success"), supportRequestService.closeByMember(id, principal.id()));
    }

    /** POST /{id}/escalate: lễ tân chuyển phiếu lên quản lý kèm lý do. */
    @Operation(summary = "Lễ tân chuyển khiếu nại không tự xử lý được lên quản lý")
    @PostMapping("/{id}/escalate")
    @PreAuthorize("hasRole('RECEPTIONIST')")
    public ApiResponse<SupportRequestDto> escalate(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody EscalateSupportRequestDto request) {
        SupportRequestDto result = supportRequestService.escalate(id, principal.id(), principal.role(), request);
        return ApiResponse.ok(msg("support.escalate.success"), result);
    }

    /** POST /{id}/messages: gửi tin nhắn trong phiếu. */
    @Operation(summary = "Gửi tin nhắn mới vào yêu cầu hỗ trợ (SCRUM-106)")
    @PostMapping("/{id}/messages")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER')")
    public ApiResponse<SupportRequestMessageDto> sendMessage(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CreateSupportMessageDto request) {
        SupportRequestMessageDto result = supportRequestService.sendMessage(id, principal.id(), principal.role(), request);
        return ApiResponse.ok(msg("support.message.send.success"), result);
    }

    /** GET /{id}/messages: các tin nhắn trong phiếu theo thứ tự thời gian. */
    @Operation(summary = "Lấy lịch sử hội thoại trong yêu cầu hỗ trợ theo thời gian (SCRUM-106)")
    @GetMapping("/{id}/messages")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER')")
    public ApiResponse<List<SupportRequestMessageDto>> getMessages(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<SupportRequestMessageDto> result = supportRequestService.getMessages(id, principal.id(), principal.role());
        return ApiResponse.ok(msg("support.messages.list.success"), result);
    }
}
