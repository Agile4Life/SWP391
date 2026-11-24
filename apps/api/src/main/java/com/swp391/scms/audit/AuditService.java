package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.dto.AuditLogDto;
import com.swp391.scms.common.exception.BadRequestException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
        LocalDateTime from = parseDateTime(fromStr, false);
        LocalDateTime to = parseDateTime(toStr, true);

        Specification<AuditLog> spec = AuditSpecifications.filter(userId, entityType, action, from, to);
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
     * Đọc chuỗi thời gian: có giờ (kể cả có múi giờ) thì đọc trực tiếp; chỉ có ngày thì lấy đầu ngày, hoặc cuối
     * ngày nếu là mốc kết thúc.
     */
    private LocalDateTime parseDateTime(String text, boolean endOfDay) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            if (text.contains("T")) {
                if (text.endsWith("Z") || text.matches(".*[+-]\\d{2}:?\\d{2}$")) {
                    return OffsetDateTime.parse(text).toLocalDateTime();
                }
                return LocalDateTime.parse(text);
            } else {
                LocalDate date = LocalDate.parse(text);
                return endOfDay ? date.atTime(LocalTime.MAX) : date.atStartOfDay();
            }
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
