package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.WaitlistDto;
import com.swp391.scms.scheduling.service.WaitlistService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SCRUM-74: class waitlist endpoints (API foundation only).
 */
@Tag(name = "Class Waitlists", description = "Smart waitlist when a class is full (SCRUM-74)")
@RestController
@RequestMapping("/api/v1/classes")
public class WaitlistController {

    private final WaitlistService service;
    private final MessageService messageService;

    public WaitlistController(WaitlistService service) {
        this(service, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WaitlistController(WaitlistService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Join the waitlist of a full class session")
    @PostMapping("/sessions/{id}/waitlist")
    public ResponseEntity<ApiResponse<WaitlistDto>> join(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.waitlist.joined"), service.join(principal, id)));
    }

    @Operation(summary = "Withdraw the authenticated member's waitlist entry")
    @DeleteMapping("/waitlists/{id}")
    public ApiResponse<WaitlistDto> withdraw(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("scheduling.waitlist.withdrawn"), service.withdraw(principal, id));
    }

    @Operation(summary = "List the authenticated member's waitlist entries")
    @GetMapping("/waitlists/my")
    public ApiResponse<List<WaitlistDto>> myWaitlists(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("scheduling.waitlist.list"), service.myWaitlists(principal));
    }
}
