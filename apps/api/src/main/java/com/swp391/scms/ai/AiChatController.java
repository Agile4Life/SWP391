package com.swp391.scms.ai;

import com.swp391.scms.ai.dto.AiChatMessageCreateDto;
import com.swp391.scms.ai.dto.AiChatMessageDto;
import com.swp391.scms.ai.dto.AiChatReplyDto;
import com.swp391.scms.ai.dto.AiChatSessionCreateDto;
import com.swp391.scms.ai.dto.AiChatSessionDto;
import com.swp391.scms.ai.service.AiChatService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST Controller for the 24/7 AI Chatbot consulting assistant (SCRUM-118).
 */
@Tag(name = "AI Chatbot", description = "Trợ lý ảo AI tư vấn thể thao và dinh dưỡng 24/7 (SCRUM-118)")
@RestController
@RequestMapping("/api/v1/ai/chat")
public class AiChatController {

    private final AiChatService aiChatService;
    private final MessageService messageService;

    @Autowired
    public AiChatController(AiChatService aiChatService, MessageService messageService) {
        this.aiChatService = aiChatService;
        this.messageService = messageService;
    }

    public AiChatController(AiChatService aiChatService) {
        this(aiChatService, null);
    }

    @Operation(summary = "Tạo phiên trò chuyện AI mới")
    @PostMapping("/sessions")
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<AiChatSessionDto>> createSession(
            @Valid @RequestBody(required = false) AiChatSessionCreateDto request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "MEMBER";
        AiChatSessionDto created = aiChatService.createSession(request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("success.ai.chat.session.created"), created));
    }

    @Operation(summary = "Lấy danh sách phiên trò chuyện của hội viên hiện tại")
    @GetMapping("/sessions")
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<List<AiChatSessionDto>>> getMySessions(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        List<AiChatSessionDto> sessions = aiChatService.getMySessions(userId);
        return ResponseEntity.ok(ApiResponse.ok(msg("success.ai.chat.session.created"), sessions));
    }

    @Operation(summary = "Gửi tin nhắn và nhận phản hồi từ AI Chatbot")
    @PostMapping("/sessions/{id}/messages")
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<AiChatReplyDto>> sendMessage(
            @PathVariable("id") Long sessionId,
            @Valid @RequestBody AiChatMessageCreateDto request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "MEMBER";
        AiChatReplyDto reply = aiChatService.sendMessage(sessionId, request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("success.ai.chat.message.sent"), reply));
    }

    @Operation(summary = "Lấy lịch sử trò chuyện theo thứ tự thời gian")
    @GetMapping({"/sessions/{id}/history", "/sessions/{id}/messages"})
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<List<AiChatMessageDto>>> getSessionHistory(
            @PathVariable("id") Long sessionId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "MEMBER";
        List<AiChatMessageDto> history = aiChatService.getSessionHistory(sessionId, userId, role);
        return ResponseEntity.ok(ApiResponse.ok(msg("success.ai.chat.message.sent"), history));
    }

    private String msg(String key) {
        if (messageService == null) {
            return key;
        }
        return messageService.getMessage(key);
    }
}
