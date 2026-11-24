package com.swp391.scms.coaching.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dữ liệu tạo đánh giá HLV: HLV, booking 1:1 hoặc buổi lớp (chọn một), số sao 1–5, nhận xét tối đa 2000 ký tự
 * và có ẩn danh không.
 */
public record CoachReviewCreateDto(
        @NotNull Long coachId,
        Long bookingId,
        Long classSessionId,
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 2000) String comment,
        Boolean isAnonymous
) {}

