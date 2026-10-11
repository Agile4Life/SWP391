package com.swp391.scms.attendance;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.service.CenterCheckinService;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for center access QR check-in, checkout and daily history (SCRUM-75).
 */
@Tag(name = "Center Check-in", description = "QR check-in, checkout and daily history (SCRUM-75)")
@RestController
@RequestMapping("/api/v1/check-in")
public class CenterCheckinController {

    private final CenterCheckinService service;
    private final MessageService messageService;

    public CenterCheckinController(CenterCheckinService service) {
        this(service, null);
    }

    @Autowired
    public CenterCheckinController(CenterCheckinService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Scan a membership QR code at center gate (Staff only)")
    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER','MANAGER','STAFF','RECEPTIONIST','ADMIN')")
    public ResponseEntity<ApiResponse<CheckinDto>> scan(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckinRequests.Scan request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("attendance.checkin.granted"), service.scan(principal, request)));
    }

    @Operation(summary = "Check out of the center")
    @PostMapping("/{id}/checkout")
    public ApiResponse<CheckinDto> checkout(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("attendance.checkout.success"), service.checkout(principal, id));
    }

    @Operation(summary = "Get today's center check-in history (Staff only)")
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER','MANAGER','STAFF','RECEPTIONIST','ADMIN')")
    public ApiResponse<List<CheckinDto>> history(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("attendance.history.success"), service.history(principal));
    }
}
