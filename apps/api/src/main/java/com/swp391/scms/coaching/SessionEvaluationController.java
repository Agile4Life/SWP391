package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.SessionEvaluationCreateDto;
import com.swp391.scms.coaching.dto.SessionEvaluationDto;
import com.swp391.scms.coaching.service.SessionEvaluationService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
 * API đánh giá buổi tập (đã ngừng; chỉ bật khi app.coaching.evaluations.enabled=true).
 *
 * REST Controller for Coaching Session Evaluations (SCRUM-119).
 * Disabled by default: Session Evaluation endpoints have been removed from the active scope.
 */
@ConditionalOnProperty(name = "app.coaching.evaluations.enabled", havingValue = "true")
@Tag(name = "Session Evaluations", description = "Đánh giá buổi tập và nhận xét tiến độ học viên (SCRUM-119)")
@RestController
@RequestMapping("/api/v1/coaching/evaluations")
public class SessionEvaluationController {

    private final SessionEvaluationService evaluationService;
    private final MessageService messageService;

    /** Constructor cho test: không có MessageService. */
    public SessionEvaluationController(SessionEvaluationService evaluationService) {
        this(evaluationService, null);
    }

    /** Constructor chính: nhận service đánh giá và MessageService. */
    @Autowired
    public SessionEvaluationController(SessionEvaluationService evaluationService, MessageService messageService) {
        this.evaluationService = evaluationService;
        this.messageService = messageService;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: HLV/quản lý tạo đánh giá buổi tập cho hội viên. */
    @Operation(summary = "HLV chấm điểm buổi tập và ghi nhận đánh giá tiến độ")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
    @PostMapping
    public ResponseEntity<ApiResponse<SessionEvaluationDto>> createEvaluation(
            @Valid @RequestBody SessionEvaluationCreateDto request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "COACH";
        SessionEvaluationDto created = evaluationService.createEvaluation(request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("coaching.evaluation.created"), created));
    }

    /** GET /my: đánh giá liên quan tới người dùng đang đăng nhập. */
    @Operation(summary = "Xem danh sách đánh giá buổi tập của cá nhân (Hội viên hoặc HLV)")
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER')")
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<SessionEvaluationDto>>> getMyEvaluations(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "MEMBER";
        List<SessionEvaluationDto> list = evaluationService.getMyEvaluations(userId, role);
        return ResponseEntity.ok(ApiResponse.ok(msg("coaching.evaluation.list"), list));
    }

    /** GET /member/{memberId}: đánh giá của một hội viên (có kiểm tra quyền xem). */
    @Operation(summary = "Xem lịch sử đánh giá buổi tập của một hội viên")
    @PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER')")
    @GetMapping("/member/{memberId}")
    public ResponseEntity<ApiResponse<List<SessionEvaluationDto>>> getMemberEvaluations(
            @PathVariable Long memberId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "MEMBER";
        List<SessionEvaluationDto> list = evaluationService.getMemberEvaluations(memberId, userId, role);
        return ResponseEntity.ok(ApiResponse.ok(msg("coaching.evaluation.list"), list));
    }

    /** GET /session/{sessionId}: đánh giá của một buổi lớp. */
    @Operation(summary = "Xem danh sách đánh giá của một buổi học")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<List<SessionEvaluationDto>>> getSessionEvaluations(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : null;
        List<SessionEvaluationDto> list = evaluationService.getSessionEvaluations(sessionId, userId, role);
        return ResponseEntity.ok(ApiResponse.ok(msg("coaching.evaluation.list"), list));
    }
}
