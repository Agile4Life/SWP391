package com.swp391.scms.ai;

import com.swp391.scms.ai.dto.AiApplyRecommendationRequest;
import com.swp391.scms.ai.dto.AiWorkoutPlanRequest;
import com.swp391.scms.ai.dto.AiWorkoutPlanResponse;
import com.swp391.scms.ai.service.AiRecommendationService;
import com.swp391.scms.coaching.dto.TrainingPlanDto;
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

/** API gợi ý giáo án bằng AI (/api/v1/ai): HLV tạo/áp dụng gợi ý; quản lý chỉ xem lịch sử gợi ý. */
@Tag(name = "AI Workout Recommendation", description = "Động cơ AI phân tích thể trạng và gợi ý giáo án bài tập cá nhân hóa (SCRUM-117)")
@PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
@RestController
@RequestMapping("/api/v1/ai")
public class AiRecommendationController {

    private final AiRecommendationService recommendationService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public AiRecommendationController(AiRecommendationService recommendationService) {
        this(recommendationService, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public AiRecommendationController(AiRecommendationService recommendationService, MessageService messageService) {
        this.recommendationService = recommendationService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST /generate-workout-plan: AI đề xuất giáo án cho hội viên dựa trên hồ sơ và yêu cầu thêm. */
    @Operation(summary = "AI gợi ý giáo án bài tập cá nhân hóa", description = "Phân tích mục tiêu, trình độ, lưu ý sức khỏe và giáo án hiện tại của hội viên để sinh giáo án JSON và lưu vết ai_recommendation_logs")
    @PreAuthorize("hasRole('COACH')")
    @PostMapping({"/generate-workout-plan", "/recommend", "/recommendations"})
    public ResponseEntity<ApiResponse<AiWorkoutPlanResponse>> generateWorkoutPlan(
            @Valid @RequestBody AiWorkoutPlanRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : null;
        AiWorkoutPlanResponse result = recommendationService.generateWorkoutPlan(request, userId, role);
        return ResponseEntity.ok(ApiResponse.ok(msg("ai.recommend.generated"), result));
    }

    /**
     * POST /recommendations/{id}/apply: áp dụng gợi ý thành giáo án thật (có thể chỉnh trước khi lưu, có thể
     * kích hoạt ngay).
     */
    @Operation(summary = "Áp dụng gợi ý AI vào giáo án huấn luyện", description = "Tự động tạo giáo án trong training_plans với is_ai_generated = true và cập nhật is_applied = true")
    @PreAuthorize("hasRole('COACH')")
    @PostMapping("/recommendations/{id}/apply")
    public ResponseEntity<ApiResponse<TrainingPlanDto>> applyRecommendation(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) AiApplyRecommendationRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long userId = principal != null ? principal.id() : null;
        String role = principal != null ? principal.role() : "COACH";
        TrainingPlanDto applied = recommendationService.applyRecommendation(id, request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("ai.recommend.applied"), applied));
    }

    /** GET /recommendations/member/{memberId}: các gợi ý AI đã tạo cho một hội viên. */
    @Operation(summary = "Lịch sử gợi ý giáo án AI của hội viên")
    @GetMapping("/recommendations/member/{memberId}")
    public ResponseEntity<ApiResponse<List<AiWorkoutPlanResponse>>> getMemberRecommendations(
            @PathVariable Long memberId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<AiWorkoutPlanResponse> list = principal == null
                ? recommendationService.getMemberRecommendations(memberId)
                : recommendationService.getMemberRecommendations(memberId, principal.id(), principal.role());
        return ResponseEntity.ok(ApiResponse.ok(msg("ai.recommend.list"), list));
    }
}
