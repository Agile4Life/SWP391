package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.dto.AuditLogDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Service for querying and formatting Audit Logs for management inspection (SCRUM-109).
 */
@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> getAuditLogs(
            Long userId,
            String entityType,
            String action,
            String fromStr,
            String toStr,
            Pageable pageable
    ) {
        LocalDateTime from = parseDateTime(fromStr, false);
        LocalDateTime to = parseDateTime(toStr, true);

        Specification<AuditLog> spec = AuditSpecifications.filter(userId, entityType, action, from, to);
        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    public AuditLogDto toDto(AuditLog entity) {
        if (entity == null) {
            return null;
        }

        String userFullName = null;
        String userEmail = null;
        if (entity.getUser() != null) {
            userFullName = entity.getUser().getFullName();
            userEmail = entity.getUser().getEmail();
        }

        Object parsedOldValue = parseJson(entity.getOldValue());
        Object parsedNewValue = parseJson(entity.getNewValue());

        return new AuditLogDto(
                entity.getId(),
                entity.getUserId(),
                userFullName,
                userEmail,
                entity.getAction(),
                entity.getEntityType(),
                entity.getEntityId(),
                parsedOldValue,
                parsedNewValue,
                entity.getIpAddress(),
                entity.getCreatedAt()
        );
    }

    private Object parseJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return json;
        }
    }

    private LocalDateTime parseDateTime(String text, boolean endOfDay) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            if (text.contains("T")) {
                return LocalDateTime.parse(text);
            } else {
                LocalDate date = LocalDate.parse(text);
                return endOfDay ? date.atTime(LocalTime.MAX) : date.atStartOfDay();
            }
        } catch (Exception e) {
            return null;
        }
    }
}

