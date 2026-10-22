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
 * REST Controller for Coaching Session Evaluations (SCRUM-119).
 */
@Tag(name = "Session Evaluations", description = "Đánh giá buổi tập và nhận xét tiến độ học viên (SCRUM-119)")
@RestController
@RequestMapping("/api/v1/coaching/evaluations")
public class SessionEvaluationController {

    private final SessionEvaluationService evaluationService;
    private final MessageService messageService;

    public SessionEvaluationController(SessionEvaluationService evaluationService) {
        this(evaluationService, null);
    }

    @Autowired
    public SessionEvaluationController(SessionEvaluationService evaluationService, MessageService messageService) {
        this.evaluationService = evaluationService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

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

    @Operation(summary = "Xem danh sách đánh giá của một buổi học")
    @PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<List<SessionEvaluationDto>>> getSessionEvaluations(
            @PathVariable Long sessionId) {
        List<SessionEvaluationDto> list = evaluationService.getSessionEvaluations(sessionId);
        return ResponseEntity.ok(ApiResponse.ok(msg("coaching.evaluation.list"), list));
    }
}
