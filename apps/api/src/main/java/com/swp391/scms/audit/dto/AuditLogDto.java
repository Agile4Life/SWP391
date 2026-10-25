package com.swp391.scms.audit.dto;

import java.time.LocalDateTime;

/**
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

