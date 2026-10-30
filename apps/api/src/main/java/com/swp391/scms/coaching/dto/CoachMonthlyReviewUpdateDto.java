package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;

public record CoachMonthlyReviewUpdateDto(
        Integer rankPosition,
        String badge,
        BigDecimal bonusAmount,
        String managerFeedback,
        String status
) {}

