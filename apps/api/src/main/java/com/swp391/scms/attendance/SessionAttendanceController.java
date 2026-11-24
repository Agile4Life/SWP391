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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API điểm danh lớp nhóm (tính năng cũ, chỉ bật khi app.legacy.classes-enabled=true).
 *
 * SCRUM-111: Controller điểm danh buổi học. Cung cấp endpoint để HLV và nhân viên xem danh sách điểm danh và
 * ghi điểm danh hàng loạt.
 */
@Tag(name = "Session Attendance", description = "Class session attendance tracking (SCRUM-111)")
@RestController
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
@RequestMapping("/api/v1/attendance")
public class SessionAttendanceController {

    private final SessionAttendanceService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public SessionAttendanceController(SessionAttendanceService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public SessionAttendanceController(SessionAttendanceService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** GET /sessions/history: các buổi đã điểm danh/đánh giá trong khoảng ngày. */
    @Operation(summary = "Past sessions with attendance or evaluations recorded (coach: own classes)")
    @GetMapping("/sessions/history")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<List<com.swp391.scms.attendance.dto.CoachSessionHistoryItem>> getHistory(
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("attendance.roster.success"), service.getHistory(principal, from, to));
    }

    /** GET /sessions/{id}: danh sách học viên của buổi kèm trạng thái điểm danh. */
    @Operation(summary = "Get enrolled members and attendance status for a session")
    @GetMapping("/sessions/{id}")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<SessionAttendanceResponse> getSessionAttendanceRoster(@PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("attendance.roster.success"), service.getSessionAttendanceRoster(id, principal));
    }

    /** POST /sessions/{id}/batch: điểm danh hàng loạt cho buổi (có thể kèm điểm đánh giá). */
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
