package com.swp391.scms.coaching;

import com.swp391.scms.coaching.service.CoachAssignmentService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** API chỉ đọc cho quản lý trung tâm xem phân công HLV (giáo án, PT 1:1, lớp) của hội viên. */
@Tag(name = "Manager Coach Assignments", description = "Quản lý và theo dõi học viên đang được các HLV phụ trách (SCRUM Manager)")
@RestController
@RequestMapping("/api/v1/manager/coach-assignments")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
public class CoachAssignmentController {

    private final CoachAssignmentService coachAssignmentService;
    private final MessageService messageService;

    /** Khởi tạo controller với service phân công HLV và MessageService. */
    @Autowired
    public CoachAssignmentController(
            CoachAssignmentService coachAssignmentService,
            @Autowired(required = false) MessageService messageService
    ) {
        this.coachAssignmentService = coachAssignmentService;
        this.messageService = messageService;
    }

    /** Dịch message key sang thông báo theo ngôn ngữ của request. */
    private String msg(String code) {
        return messageService == null ? code : messageService.getMessage(code);
    }

    /** GET: trả về tổng quan phân công, lọc theo HLV, từ khóa, loại và sắp xếp theo tham số truyền vào. */
    @Operation(summary = "Xem danh sách và tổng quan các HLV kèm học viên phụ trách")
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getOverview(
            @RequestParam(required = false) Long coachId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir
    ) {
        Map<String, Object> data = coachAssignmentService.getOverview(coachId, search, type, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.ok(
                msg("manager.coach_assignments.loaded"),
                data
        ));
    }
}
