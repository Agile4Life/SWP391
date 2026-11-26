package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RescheduleSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.UpdateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.CoachOptionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.EnrolledStudentDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.RecurringAvailabilityDto;
import com.swp391.scms.scheduling.service.ClassService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * API quản lý lớp học nhóm và buổi học (đã ngừng; chỉ bật khi app.legacy.classes-enabled=true).
 *
 * SCRUM-72 & SCRUM-131: endpoint lớp học và lịch. Thao tác ghi giới hạn cho CENTER_MANAGER; đọc lịch mở cho
 * mọi vai trò đã xác thực.
 */
@Tag(name = "Classes & Sessions", description = "Class management and class schedule (SCRUM-72, SCRUM-131)")
@RestController
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
@RequestMapping("/api/v1/classes")
public class ClassController {

    private final ClassService service;
    private final MessageService messageService;

    /** Constructor cho test: không có MessageService. */
    public ClassController(ClassService service) {
        this(service, null);
    }

    /** Constructor chính: nhận ClassService và MessageService. */
    @org.springframework.beans.factory.annotation.Autowired
    public ClassController(ClassService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: tạo lớp một buổi — đã ngừng, luôn ném lỗi SingleSessionPolicy (dùng POST /recurring). */
    @Operation(summary = "Retired: one-off classes are no longer created; use /recurring", deprecated = true)
    @PostMapping
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ResponseEntity<ApiResponse<GymClassDto>> createClass(@Valid @RequestBody CreateClassRequest request) {
        // Lớp lẻ đã ngừng; dùng POST /classes/recurring.
        throw SingleSessionPolicy.rejection();
    }

    /** POST /recurring: quản lý tạo khóa học định kỳ (sinh sẵn các buổi theo lịch tuần). */
    @Operation(summary = "Create a recurring course (CENTER_MANAGER only)")
    @PostMapping("/recurring")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ResponseEntity<ApiResponse<GymClassDto>> createRecurringClass(@Valid @RequestBody CreateRecurringClassRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.class.created"), service.createRecurringClass(request)));
    }

    /** POST /recurring/availability: kiểm tra trước lịch trống trên 5 slot cố định, phòng tập và HLV. */
    @Operation(summary = "Preview schedule availability & conflicts across 5 fixed slots, rooms, and coaches (CENTER_MANAGER only)")
    @PostMapping("/recurring/availability")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ApiResponse<RecurringAvailabilityDto> checkRecurringAvailability(
            @Valid @RequestBody RecurringAvailabilityRequest request) {
        return ApiResponse.ok(msg("scheduling.availability.checked"), service.checkRecurringAvailability(request));
    }

    /** PUT /{id}: quản lý cập nhật thông tin lớp/khóa học. */
    @Operation(summary = "Update a class (CENTER_MANAGER only)")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ApiResponse<GymClassDto> updateClass(@PathVariable Long id,
                                                @Valid @RequestBody UpdateClassRequest request) {
        return ApiResponse.ok(msg("scheduling.class.updated"), service.updateClass(id, request));
    }

    /** DELETE /{id}: quản lý xóa hoặc đóng lớp (service quyết định tùy dữ liệu phụ thuộc). */
    @Operation(summary = "Delete a class (CENTER_MANAGER only)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ApiResponse<Void> deleteClass(@PathVariable Long id) {
        service.deleteClass(id);
        return ApiResponse.ok(msg("scheduling.class.deleted"), null);
    }

    /** GET: danh sách lớp học. */
    @Operation(summary = "List classes")
    @GetMapping
    public ApiResponse<List<GymClassDto>> listClasses() {
        return ApiResponse.ok(msg("scheduling.class.list"), service.listClasses());
    }

    /** GET /coaches: danh sách HLV đang hoạt động để chọn khi xếp lớp và lọc. */
    @Operation(summary = "List active coaches for class scheduling and filtering")
    @GetMapping("/coaches")
    public ApiResponse<List<CoachOptionDto>> listActiveCoaches() {
        return ApiResponse.ok(msg("scheduling.class.list"), service.listActiveCoaches());
    }

    /** POST /{id}/sessions: quản lý xếp thêm một buổi cho lớp. */
    @Operation(summary = "Schedule a session for a class (CENTER_MANAGER only)")
    @PostMapping("/{id}/sessions")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ResponseEntity<ApiResponse<ClassSessionDto>> createSession(@PathVariable Long id,
                                                                     @Valid @RequestBody CreateSessionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.session.created"), service.createSession(id, request)));
    }

    /** PUT /{id}/sessions/{sessionId}: quản lý dời lịch một buổi học. */
    @Operation(summary = "Reschedule an existing class session (CENTER_MANAGER only)")
    @PutMapping("/{id}/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
    public ApiResponse<ClassSessionDto> rescheduleSession(@PathVariable Long id,
                                                          @PathVariable Long sessionId,
                                                          @Valid @RequestBody RescheduleSessionRequest request) {
        return ApiResponse.ok(msg("scheduling.session.rescheduled"), service.rescheduleSession(id, sessionId, request));
    }

    /**
     * GET /sessions: danh sách buổi học lọc theo ngày, bộ môn, HLV, lớp; HLV đăng nhập chỉ thấy buổi của chính
     * mình.
     */
    @Operation(summary = "List class sessions with optional filters (date range, discipline, coach, classId); a COACH only ever sees their own sessions")
    @GetMapping("/sessions")
    public ApiResponse<List<ClassSessionDto>> listSessions(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) Long disciplineId,
            @RequestParam(required = false) Long coachId,
            @RequestParam(required = false) Long classId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long effectiveCoachId = principal != null && "COACH".equalsIgnoreCase(principal.role()) ? principal.id() : coachId;
        List<ClassSessionDto> result = service.searchSessions(fromDate, toDate, disciplineId, effectiveCoachId);
        if (classId != null) {
            result = result.stream().filter(s -> classId.equals(s.classId())).toList();
        }
        return ApiResponse.ok(msg("scheduling.session.list"), result);
    }

    /** GET /{id}/students: học viên đã ghi danh của lớp kèm ghi chú sức khỏe (HLV chỉ xem lớp mình dạy). */
    @Operation(summary = "Get enrolled students and health notes for a class")
    @GetMapping("/{id}/students")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<List<EnrolledStudentDto>> getClassStudents(@PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("scheduling.class.list"), service.getClassStudents(id, principal));
    }

    /** GET /sessions/{sessionId}/students: học viên của một buổi học kèm ghi chú sức khỏe. */
    @Operation(summary = "Get enrolled students and health notes for a class session")
    @GetMapping("/sessions/{sessionId}/students")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'STAFF', 'RECEPTIONIST')")
    public ApiResponse<List<EnrolledStudentDto>> getSessionStudents(@PathVariable Long sessionId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("scheduling.session.list"), service.getSessionStudents(sessionId, principal));
    }
}
