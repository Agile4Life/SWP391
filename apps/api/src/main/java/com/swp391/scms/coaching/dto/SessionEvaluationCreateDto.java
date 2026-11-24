package com.swp391.scms.coaching.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO yêu cầu tạo đánh giá buổi tập (SCRUM-119): buổi lớp (tùy chọn), hội viên, HLV (tùy chọn), điểm tiến bộ 1–100 và
 * các nhận xét.
 */
public record SessionEvaluationCreateDto(
        Long sessionId,

        @NotNull(message = "{validation.coaching.member_id.not_null}")
        Long memberId,

        Long coachId,

        @NotNull(message = "{validation.coaching.progress_score.not_null}")
        @DecimalMin(value = "1.0", message = "{validation.coaching.progress_score.range}")
        @DecimalMax(value = "100.0", message = "{validation.coaching.progress_score.range}")
        BigDecimal progressScore,

        @Size(max = 2000, message = "{validation.coaching.performance_notes.size}")
        String performanceNotes,

        @Size(max = 2000, message = "{validation.coaching.feedback.size}")
        String feedback,

        LocalDateTime evaluatedAt
) {
}
