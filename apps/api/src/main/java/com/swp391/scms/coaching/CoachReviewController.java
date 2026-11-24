package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachReviewCreateDto;
import com.swp391.scms.coaching.dto.CoachReviewDto;
import com.swp391.scms.coaching.service.CoachReviewService;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API đánh giá HLV (đã ngừng; chỉ bật khi app.coaching.reviews.enabled=true).
 *
 * Disabled by default: Coach Review endpoints have been removed from the active scope.
 */
@ConditionalOnProperty(name = "app.coaching.reviews.enabled", havingValue = "true")
@Tag(name = "Coach Reviews", description = "Hội viên đánh giá Huấn luyện viên (SCRUM-134)")
@RestController
@RequestMapping("/api/v1/coaching/reviews")
public class CoachReviewController {

    private final CoachReviewService reviewService;
    private final MessageService messageService;

    /** Constructor cho test: không có MessageService. */
    public CoachReviewController(CoachReviewService reviewService) {
        this(reviewService, null);
    }

    /** Constructor chính: nhận service đánh giá và MessageService. */
    @Autowired
    public CoachReviewController(CoachReviewService reviewService, MessageService messageService) {
        this.reviewService = reviewService;
        this.messageService = messageService;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: hội viên gửi đánh giá cho HLV sau buổi tập đã tham dự. */
    @Operation(summary = "Hội viên đánh giá Huấn luyện viên", description = "Gửi số sao (1-5) và nhận xét cho HLV sau khóa/buổi tập (SCRUM-134)")
    @PreAuthorize("hasRole('MEMBER')")
    @PostMapping
    public ResponseEntity<ApiResponse<CoachReviewDto>> createReview(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CoachReviewCreateDto request) {
        CoachReviewDto created = reviewService.createReview(principal.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("coaching.review.create.success"), created));
    }

    /** GET /coach/{coachId}: danh sách đánh giá đã duyệt của một HLV. */
    @Operation(summary = "Xem danh sách đánh giá của Huấn luyện viên", description = "Xem các đánh giá đã duyệt của 1 HLV cụ thể")
    @GetMapping("/coach/{coachId}")
    public ApiResponse<List<CoachReviewDto>> getCoachReviews(@PathVariable("coachId") Long coachId) {
        List<CoachReviewDto> reviews = reviewService.getApprovedReviewsForCoach(coachId);
        return ApiResponse.ok(msg("coaching.review.list.success"), reviews);
    }

    /** GET /my: các đánh giá hội viên đang đăng nhập đã viết. */
    @Operation(summary = "Xem các đánh giá đã gửi của tôi", description = "Hội viên xem lại các đánh giá đã gửi cho HLV")
    @PreAuthorize("hasRole('MEMBER')")
    @GetMapping("/my")
    public ApiResponse<List<CoachReviewDto>> getMyReviews(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<CoachReviewDto> reviews = reviewService.getMyReviews(principal.id());
        return ApiResponse.ok(msg("coaching.review.my.success"), reviews);
    }
}

