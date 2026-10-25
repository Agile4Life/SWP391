package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
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
