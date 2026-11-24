package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thông tin một đánh giá buổi tập trả về client: buổi, hội viên, HLV, nhận xét hiệu suất, điểm tiến bộ, phản
 * hồi và các mốc thời gian.
 *
 * Response DTO for a session evaluation (SCRUM-119).
 */
public record SessionEvaluationDto(
        Long id,
        Long sessionId,
        Long memberId,
        String memberCode,
        Long coachId,
        String performanceNotes,
        BigDecimal progressScore,
        String feedback,
        LocalDateTime evaluatedAt,
        LocalDateTime createdAt
) {
}
