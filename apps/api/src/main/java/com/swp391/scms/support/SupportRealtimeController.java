package com.swp391.scms.support;

import com.swp391.scms.chat.dto.ChatRealtimeSession;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** API mở kênh realtime cho khiếu nại/hỗ trợ: theo dõi một phiếu, hoặc hộp thư chung của quầy. */
@RestController
@RequestMapping("/api/v1/support/requests")
public class SupportRealtimeController {
    private final SupportRealtimeService service;
    private final MessageService messages;
    /** Constructor cho test, không có MessageService. */
    public SupportRealtimeController(SupportRealtimeService service) { this(service, null); }
    @Autowired public SupportRealtimeController(SupportRealtimeService service, MessageService messages) {
        this.service = service; this.messages = messages;
    }
    /** Đóng gói phiên realtime thành phản hồi thành công. */
    private ResponseEntity<ApiResponse<ChatRealtimeSession>> response(ChatRealtimeSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(
                messages == null ? "support.realtime.ready" : messages.getMessage("support.realtime.ready"), session));
    }
    /** POST /{id}/realtime-session: mở kênh realtime của một phiếu hỗ trợ (hội viên chủ phiếu, lễ tân, quản lý). */
    @PostMapping("/{id}/realtime-session")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER')")
    public ResponseEntity<ApiResponse<ChatRealtimeSession>> ticket(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return response(service.ticket(id, actor));
    }
    /** POST /realtime-session: mở kênh realtime của hộp thư hỗ trợ cho lễ tân, quản lý và danh sách phiếu của hội viên. */
    @PostMapping("/realtime-session")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER')")
    public ResponseEntity<ApiResponse<ChatRealtimeSession>> inbox(@AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return response(service.inbox(actor));
    }
}
