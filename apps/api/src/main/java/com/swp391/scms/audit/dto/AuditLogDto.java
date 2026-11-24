package com.swp391.scms.audit.dto;

import java.time.LocalDateTime;

/**
 * Một dòng audit log trả cho client: người thực hiện (id, họ tên, email), hành động, loại và id bản ghi, giá
 * trị cũ/mới dạng JSON, IP và thời điểm.
 *
 * Đối tượng truyền dữ liệu để hiển thị bản ghi nhật ký audit đã định dạng (SCRUM-109). oldValue và newValue
 * được phân tích thành JSON có cấu trúc để frontend hiển thị gọn gàng.
 */
public record AuditLogDto(
        Long id,
        Long userId,
        String userFullName,
        String userEmail,
        String action,
        String entityType,
        Long entityId,
        Object oldValue,
        Object newValue,
        String ipAddress,
        LocalDateTime createdAt
) {}

