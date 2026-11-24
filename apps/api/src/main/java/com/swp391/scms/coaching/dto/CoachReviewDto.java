package com.swp391.scms.coaching.dto;

import java.time.LocalDateTime;

/**
 * Thông tin một đánh giá HLV trả về client: HLV, hội viên, nguồn (booking/buổi lớp), số sao, nhận xét, ẩn danh,
 * trạng thái duyệt và thời điểm tạo.
 */
public record CoachReviewDto(
        Long id,
        Long coachId,
        String coachName,
        String coachSpecialization,
        String coachAvatarUrl,
        Long memberId,
        String memberName,
        Long bookingId,
        Long classSessionId,
        Integer rating,
        String comment,
        Boolean isAnonymous,
        String status,
        LocalDateTime createdAt
) {}

