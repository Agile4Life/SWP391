package com.swp391.scms.chat.controller;

import com.swp391.scms.chat.dto.ChatRealtimeSession;
import com.swp391.scms.chat.service.ChatRealtimeService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ChatRealtimeController {
    private final ChatRealtimeService service;
    private final MessageService messages;
    public ChatRealtimeController(ChatRealtimeService service) { this(service, null); }
    @Autowired public ChatRealtimeController(ChatRealtimeService service, MessageService messages) { this.service = service; this.messages = messages; }

    @PostMapping("/api/v1/chat/realtime-session")
    @PreAuthorize("hasAnyRole('MEMBER', 'RECEPTIONIST', 'COACH')")
    public ResponseEntity<ApiResponse<ChatRealtimeSession>> session(@AuthenticationPrincipal AuthenticatedPrincipal p) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.ok(messages == null ? "chat.realtime.ready" : messages.getMessage("chat.realtime.ready"), service.open(p)));
    }
}
