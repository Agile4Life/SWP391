package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.dto.AuditLogDto;
import com.swp391.scms.common.CenterTime;
import com.swp391.scms.common.exception.BadRequestException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/**
 * Đọc nhật ký kiểm toán cho màn hình Admin.
 *
 * Service truy vấn và định dạng nhật ký audit cho việc kiểm tra của quản lý (SCRUM-109).
 */
@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    /** Nhận repository audit và ObjectMapper để đọc giá trị JSON. */
    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    /** Mốc thời gian đã phân tích cùng cờ cận trên nửa mở (strict <) khi đầu vào chỉ gồm ngày. */
    record ParsedBound(LocalDateTime value, boolean exclusive) {}

    /**
     * Lọc audit log theo người thực hiện, loại bản ghi, hành động và khoảng thời gian (chuỗi ngày hoặc ngày
     * giờ), có phân trang.
     */
    @Transactional(readOnly = true)
    public Page<AuditLogDto> getAuditLogs(
            Long userId,
            String entityType,
            String action,
            String fromStr,
            String toStr,
            Pageable pageable
    ) {
        ParsedBound fromBound = parseDateTimeBound(fromStr, false);
        ParsedBound toBound = parseDateTimeBound(toStr, true);
        LocalDateTime from = fromBound != null ? fromBound.value() : null;
        LocalDateTime to = toBound != null ? toBound.value() : null;
        boolean toExclusive = toBound != null && toBound.exclusive();

        if (from != null && to != null) {
            boolean invalidRange = toExclusive ? !from.isBefore(to) : from.isAfter(to);
            if (invalidRange) {
                throw new BadRequestException(
                        "INVALID_DATE_RANGE",
                        "reports.revenue.invalid_date_range",
                        null,
                        "Start date cannot be after end date"
                );
            }
        }

        Specification<AuditLog> spec = AuditSpecifications.filter(userId, entityType, action, from, to, toExclusive);
        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    /** Chuyển bản ghi audit sang DTO: kèm họ tên/email người thực hiện và giá trị cũ/mới đã đọc thành JSON. */
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

    /** Đọc chuỗi JSON thành cây JSON; lỗi thì trả nguyên chuỗi. */
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

    /**
     * Đọc chuỗi thời gian theo múi giờ trung tâm (CenterTime.ZONE): chuỗi có offset được quy đổi cùng thời điểm
     * sang giờ trung tâm; chuỗi chỉ có ngày dùng đầu ngày cho {@code from} và đầu ngày kế tiếp (cận trên mở) cho
     * {@code to} để tránh làm tròn LocalTime.MAX trong PostgreSQL.
     */
    ParsedBound parseDateTimeBound(String text, boolean endOfDay) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.trim();
        try {
            if (trimmed.contains("T")) {
                if (trimmed.endsWith("Z") || trimmed.matches(".*[+-]\\d{2}:?\\d{2}$")) {
                    LocalDateTime inCenterZone = OffsetDateTime.parse(trimmed)
                            .atZoneSameInstant(CenterTime.ZONE)
                            .toLocalDateTime();
                    return new ParsedBound(inCenterZone, false);
                }
                return new ParsedBound(LocalDateTime.parse(trimmed), false);
            }
            LocalDate date = LocalDate.parse(trimmed);
            if (endOfDay) {
                return new ParsedBound(date.plusDays(1).atStartOfDay(), true);
            }
            return new ParsedBound(date.atStartOfDay(), false);
        } catch (Exception e) {
            throw new BadRequestException(
                    "INVALID_DATE_FORMAT",
                    "audit.invalid_date_format",
                    new Object[]{text},
                    "Định dạng ngày không hợp lệ: " + text
            );
        }
    }
}
