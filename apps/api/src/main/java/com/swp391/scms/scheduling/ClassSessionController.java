package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.CancelSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.service.ClassSessionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * SCRUM-113: Class Session Controller.
 * Provides endpoints to manage class sessions lifecycle such as cancellation and notification workflows.
 */
@Tag(name = "Class Sessions", description = "Class session lifecycle and cancellation management (SCRUM-113)")
@RestController
@RequestMapping("/api/v1/classes/sessions")
public class ClassSessionController {

    private final ClassSessionService sessionService;
    private final MessageService messageService;

    public ClassSessionController(ClassSessionService sessionService) {
        this(sessionService, null);
    }

    @Autowired
    public ClassSessionController(ClassSessionService sessionService, MessageService messageService) {
        this.sessionService = sessionService;
        this.messageService = messageService;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    @Operation(summary = "Cancel a class session with reason and notify enrolled members")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<ClassSessionDto> cancelSession(
            @PathVariable Long id,
            @Valid @RequestBody CancelSessionRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        ClassSessionDto sessionDto = sessionService.cancelSession(id, request, principal);
        return ApiResponse.ok(msg("scheduling.session.cancelled"), sessionDto);
    }
}
