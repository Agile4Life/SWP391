package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;

/**
 * Thông tin công khai của HLV cho hội viên chọn: họ tên, liên hệ, chuyên môn, giới thiệu, chứng chỉ, ảnh và giá
 * mặc định theo giờ.
 */
public record CoachPublicDto(
        Long id,
        String fullName,
        String email,
        String phone,
        String specialization,
        String bio,
        String certification,
        String avatarUrl,
        BigDecimal defaultHourlyRate
) {}
