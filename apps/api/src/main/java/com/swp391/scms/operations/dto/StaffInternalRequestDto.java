package com.swp391.scms.operations.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Đơn nội bộ trả cho client: người gửi (id, tên, email, vai trò), loại, tiêu đề, lý do, khoảng ngày, ca, người
 * thay ca, trạng thái, ghi chú, người/thời điểm duyệt, thời điểm tạo/cập nhật và số buổi lớp/PT bị ảnh hưởng (khi
 * duyệt đơn nghỉ).
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
        LocalDateTime updatedAt,
        long affectedClassSessionCount,
        long affectedPtSessionCount
) {
    /** Constructor rút gọn khi không có số buổi bị ảnh hưởng. */
    public StaffInternalRequestDto(
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
    ) {
        this(id, userId, userFullName, userEmail, userRole, requestType, title, reason, startDate, endDate,
                targetShift, replacementUserId, replacementUserFullName, status, managerNotes, reviewedByUserId,
                reviewedByName, reviewedAt, createdAt, updatedAt, 0L, 0L);
    }
}

