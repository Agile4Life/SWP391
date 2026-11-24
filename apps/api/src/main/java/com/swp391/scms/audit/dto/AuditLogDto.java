package com.swp391.scms.audit.dto;

import java.time.LocalDateTime;

/**
 * Một dòng audit log trả cho client: người thực hiện (id, họ tên, email), hành động, loại và id bản ghi, giá
 * trị cũ/mới dạng JSON, IP và thời điểm.
 *
 * Data Transfer Object for presenting formatted Audit Log records (SCRUM-109).
 * oldValue and newValue are parsed as structured JSON for clean frontend display.
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

