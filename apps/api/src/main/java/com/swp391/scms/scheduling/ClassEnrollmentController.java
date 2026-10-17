package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.ClassEnrollmentDto;
import com.swp391.scms.scheduling.service.ClassEnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Class Enrollments", description = "Đăng ký và quản lý tham gia lớp học của hội viên (SCRUM-73)")
@RestController
@RequestMapping("/api/v1/classes/enrollments")
public class ClassEnrollmentController {

    private final ClassEnrollmentService enrollmentService;
    private final MessageService messageService;

    public ClassEnrollmentController(ClassEnrollmentService enrollmentService) {
        this(enrollmentService, null);
    }

    @Autowired
    public ClassEnrollmentController(ClassEnrollmentService enrollmentService, MessageService messageService) {
        this.enrollmentService = enrollmentService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(
            summary = "Lấy danh sách các lớp/buổi học đã đăng ký của hội viên hiện tại",
            description = "Trả về danh sách lượt đăng ký lớp học của hội viên đang đăng nhập với thông tin buổi học, HLV, phòng tập. Hỗ trợ lọc theo trạng thái và sắp diễn ra/lịch sử."
    )
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Lấy danh sách thành công"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có quyền truy cập (yêu cầu role MEMBER)")
    })
    @GetMapping("/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<List<ClassEnrollmentDto>>> getMyEnrollments(
            @Parameter(hidden = true)
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Parameter(description = "Lọc theo trạng thái đặt chỗ (booked, cancelled, completed)")
            @RequestParam(required = false) String status,
            @Parameter(description = "true: chỉ lấy buổi sắp diễn ra, false: chỉ lấy lịch sử/đã hoàn thành, để trống: lấy tất cả")
            @RequestParam(required = false) Boolean upcoming) {
        List<ClassEnrollmentDto> enrollments = enrollmentService.getMyEnrollments(principal, status, upcoming);
        return ResponseEntity.ok(ApiResponse.ok(msg("scheduling.enrollment.list"), enrollments));
    }
}
