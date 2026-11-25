package com.swp391.scms.operations.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Đơn nội bộ trả cho client: người gửi (id, tên, email, vai trò), loại, tiêu đề, lý do, khoảng ngày, ca, người
 * thay ca, trạng thái, ghi chú và người/thời điểm duyệt, thời điểm tạo/cập nhật.
 */
public record StaffInternalRequestDto(
        Long id,
        Long userId,
        String userFullName,
        String userEmail,
        String userRole,
        String requestType,
        String title,
        String reason,
        LocalDate startDate,
        LocalDate endDate,
        String targetShift,
        Long replacementUserId,
        String replacementUserFullName,
        String status,
        String managerNotes,
        Long reviewedByUserId,
        String reviewedByName,
        LocalDateTime reviewedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}

