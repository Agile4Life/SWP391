package com.swp391.scms.attendance;

import com.swp391.scms.attendance.dto.BatchAttendanceRequest;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse.MemberAttendanceItem;
import com.swp391.scms.attendance.service.SessionAttendanceService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SCRUM-111: Session Attendance Controller.
 * Provides endpoints for coaches and staff to inspect attendance rosters and record batch attendance.
 */
@Tag(name = "Session Attendance", description = "Class session attendance tracking (SCRUM-111)")
@RestController
@RequestMapping("/api/v1/attendance")
public class SessionAttendanceController {

    private final SessionAttendanceService service;
    private final MessageService messageService;

    public SessionAttendanceController(SessionAttendanceService service) {
        this(service, null);
    }

    @Autowired
    public SessionAttendanceController(SessionAttendanceService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    @Operation(summary = "Get enrolled members and attendance status for a session")
    @GetMapping("/sessions/{id}")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<SessionAttendanceResponse> getSessionAttendanceRoster(@PathVariable Long id) {
        return ApiResponse.ok(msg("attendance.roster.success"), service.getSessionAttendanceRoster(id));
    }

    @Operation(summary = "Batch record attendance for session members")
    @PostMapping("/sessions/{id}/batch")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<List<MemberAttendanceItem>> recordBatchAttendance(
            @PathVariable Long id,
            @Valid @RequestBody BatchAttendanceRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<MemberAttendanceItem> records = service.recordBatchAttendance(id, request, principal);
        return ApiResponse.ok(msg("attendance.batch.success"), records);
    }
}
