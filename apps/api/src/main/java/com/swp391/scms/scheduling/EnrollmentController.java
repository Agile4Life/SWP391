package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.QuotaDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.CourseCheckoutDto;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CourseCheckoutRequest;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * API ghi danh lớp/khóa học của hội viên (đã ngừng; chỉ bật khi app.legacy.classes-enabled=true).
 *
 * SCRUM-73: endpoint đặt chỗ và hủy lớp học.
 */
@Tag(name = "Class Enrollments", description = "Member class booking and cancellation (SCRUM-73)")
@RestController
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
@RequestMapping("/api/v1/classes")
public class EnrollmentController {

    private final EnrollmentService service;
    private final MessageService messageService;

    /** Constructor cho test: không có MessageService. */
    public EnrollmentController(EnrollmentService service) {
        this(service, null);
    }

    /** Constructor chính: nhận EnrollmentService và MessageService. */
    @org.springframework.beans.factory.annotation.Autowired
    public EnrollmentController(EnrollmentService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST /sessions/{id}/enroll: ghi danh từng buổi — đã ngừng, luôn ném lỗi SingleSessionPolicy. */
    @Operation(summary = "Retired: enroll in a recurring course instead", deprecated = true)
    @PostMapping("/sessions/{id}/enroll")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<EnrollmentDto>> enroll(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        throw SingleSessionPolicy.rejection();
    }

    /** DELETE /enrollments/{id}: hủy một lượt ghi danh (chủ sở hữu hoặc nhân viên). */
    @Operation(summary = "Cancel a class enrollment (owner or staff)")
    @DeleteMapping("/enrollments/{id}")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<EnrollmentDto> cancel(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("scheduling.enrollment.cancelled"), service.cancel(principal, id));
    }

    /** GET /enrollments/my: các lượt ghi danh của hội viên đang đăng nhập, lọc theo trạng thái (tùy chọn). */
    @Operation(summary = "List the authenticated member's class enrollments")
    @GetMapping("/enrollments/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<List<EnrollmentDto>> myEnrollments(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(msg("scheduling.enrollment.list"), service.myEnrollments(principal, status));
    }

    /** Overload không lọc trạng thái, dùng trong test. */
    public ApiResponse<List<EnrollmentDto>> myEnrollments(AuthenticatedPrincipal principal) {
        return myEnrollments(principal, null);
    }

    /** GET /my-quota: hạn mức khóa học (credit) còn lại của hội viên. */
    @Operation(summary = "Get the authenticated member's course quota")
    @GetMapping({"/my-quota", "/classes/my-quota"})
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<QuotaDto> myCourseQuota(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("scheduling.quota.info"), service.getMemberCourseQuota(principal));
    }

    /** POST /{id}/enroll: ghi danh hội viên vào cả khóa học định kỳ. */
    @Operation(summary = "Enroll the authenticated member in a recurring course")
    @PostMapping({"/{id}/enroll", "/classes/{id}/enroll"})
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<EnrollmentDto>> enrollCourse(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.enrollment.created"), service.enrollCourse(principal, id)));
    }

    /** POST /{id}/checkout: thanh toán khóa học — miễn phí nếu còn hạn mức, trả tiền nếu vượt. */
    @Operation(summary = "Checkout a recurring course (free via quota or paid if extra)")
    @PostMapping({"/{id}/checkout", "/classes/{id}/checkout"})
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<CourseCheckoutDto>> checkoutCourse(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) CourseCheckoutRequest request) {
        String method = request != null && request.method() != null ? request.method() : "cash";
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.enrollment.checkout_created"), service.checkoutCourse(principal, id, method)));
    }

    /** DELETE /{id}/enroll: hủy ghi danh khóa học trước khi khóa bắt đầu. */
    @Operation(summary = "Cancel a course enrollment before course starts")
    @DeleteMapping({"/{id}/enroll", "/classes/{id}/enroll"})
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<EnrollmentDto> cancelCourse(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("scheduling.enrollment.cancelled"), service.cancelCourseEnrollment(principal, id));
    }

    /** GET /my-enrollments: các khóa học hội viên đã ghi danh. */
    @Operation(summary = "List the authenticated member's enrolled courses")
    @GetMapping({"/my-enrollments", "/classes/my-enrollments"})
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<List<EnrollmentDto>> myCourseEnrollments(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("scheduling.enrollment.list"), service.getMyCourseEnrollments(principal));
    }
}
