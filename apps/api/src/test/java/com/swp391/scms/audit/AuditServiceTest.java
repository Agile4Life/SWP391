package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.dto.AuditLogDto;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service AuditService (audit service). */
@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    private ObjectMapper objectMapper;
    private AuditService auditService;

    /** Chuẩn bị trước mỗi test: tạo AuditService với repository giả lập. */
    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        auditService = new AuditService(auditLogRepository, objectMapper);
    }

    /** Kiểm thử: lấy audit log thành công. */
    @Test
    @DisplayName("getAuditLogs returns paginated audit log DTOs with parsed JSON values")
    void getAuditLogs_Success() {
        User user = new User();
        user.setId(10L);
        user.setFullName("Quản lý Trung tâm");
        user.setEmail("manager@solfitness.vn");

        AuditLog log1 = new AuditLog();
        log1.setId(1L);
        log1.setUserId(10L);
        log1.setUser(user);
        log1.setAction("UPDATE_SUBSCRIPTION");
        log1.setEntityType("membership_subscriptions");
        log1.setEntityId(200L);
        log1.setOldValue("{\"status\":\"pending_payment\"}");
        log1.setNewValue("{\"status\":\"active\"}");
        log1.setIpAddress("192.168.1.100");
        log1.setCreatedAt(LocalDateTime.of(2026, 10, 22, 14, 30));

        PageRequest pageable = PageRequest.of(0, 20);
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log1), pageable, 1));

        Page<AuditLogDto> result = auditService.getAuditLogs(
                10L,
                "SUBSCRIPTION",
                "UPDATE",
                "2026-10-01",
                "2026-10-31",
                pageable
        );

        assertThat(result.getContent()).hasSize(1);
        AuditLogDto dto = result.getContent().get(0);
        assertThat(dto.id()).isEqualTo(1L);
        assertThat(dto.userId()).isEqualTo(10L);
        assertThat(dto.userFullName()).isEqualTo("Quản lý Trung tâm");
        assertThat(dto.action()).isEqualTo("UPDATE_SUBSCRIPTION");
        assertThat(dto.entityType()).isEqualTo("membership_subscriptions");
        assertThat(dto.entityId()).isEqualTo(200L);

        // Xác minh JSON được phân tích thành cấu trúc cây JsonNode
        assertThat(dto.oldValue()).isInstanceOf(JsonNode.class);
        assertThat(((JsonNode) dto.oldValue()).get("status").asText()).isEqualTo("pending_payment");
        assertThat(dto.newValue()).isInstanceOf(JsonNode.class);
        assertThat(((JsonNode) dto.newValue()).get("status").asText()).isEqualTo("active");

        verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    /** Kiểm thử: lấy audit log với ngày giờ ISO thành công. */
    @Test
    @DisplayName("getAuditLogs with ISO dateTime strings parses successfully")
    void getAuditLogs_WithISODateTime_Success() {
        PageRequest pageable = PageRequest.of(0, 20);
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        Page<AuditLogDto> result = auditService.getAuditLogs(
                null,
                null,
                null,
                "2026-10-01T08:30:00",
                "2026-10-31T23:59:59Z",
                pageable
        );

        assertThat(result.getContent()).isEmpty();
        verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    /** Kiểm thử: ngày bắt đầu không hợp lệ ném BadRequestException. */
    @Test
    @DisplayName("getAuditLogs with invalid from date throws BadRequestException HTTP 400")
    void getAuditLogs_InvalidFromDate_ThrowsBadRequestException() {
        PageRequest pageable = PageRequest.of(0, 20);
        assertThatThrownBy(() -> auditService.getAuditLogs(null, null, null, "invalid-date", null, pageable))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("invalid-date");
    }

    /** Kiểm thử: ngày kết thúc không hợp lệ ném BadRequestException. */
    @Test
    @DisplayName("getAuditLogs with invalid to date throws BadRequestException HTTP 400")
    void getAuditLogs_InvalidToDate_ThrowsBadRequestException() {
        PageRequest pageable = PageRequest.of(0, 20);
        assertThatThrownBy(() -> auditService.getAuditLogs(null, null, null, null, "2026-99-99", pageable))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("2026-99-99");
    }

    /** Kiểm thử: toDto dùng văn bản thuần khi không phải JSON. */
    @Test
    @DisplayName("toDto handles plain text or invalid JSON gracefully without error")
    void toDto_PlainTextFallback() {
        AuditLog log1 = new AuditLog();
        log1.setId(2L);
        log1.setUserId(15L);
        log1.setAction("LOGIN");
        log1.setEntityType("users");
        log1.setOldValue("Plain string not JSON");
        log1.setNewValue(null);

        AuditLogDto dto = auditService.toDto(log1);

        assertThat(dto.id()).isEqualTo(2L);
        assertThat(dto.oldValue()).isEqualTo("Plain string not JSON");
        assertThat(dto.newValue()).isNull();
    }

    /** Kiểm thử: specification bỏ qua giá trị lọc ALL. */
    @Test
    @DisplayName("AuditSpecifications ignores ALL placeholder for entityType and action")
    void specifications_IgnoresAllPlaceholder() {
        var root = org.mockito.Mockito.mock(jakarta.persistence.criteria.Root.class);
        var query = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaQuery.class);
        var cb = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaBuilder.class);
        var conjunction = org.mockito.Mockito.mock(jakarta.persistence.criteria.Predicate.class);
        when(cb.and()).thenReturn(conjunction);

        var spec = AuditSpecifications.filter(null, "ALL", "ALL", null, null);
        assertThat(spec.toPredicate(root, query, cb)).isSameAs(conjunction);
        org.mockito.Mockito.verifyNoInteractions(root);
    }

    /** Kiểm thử P1-BE-43: chuỗi có offset UTC được quy đổi đúng sang CenterTime.ZONE (+07:00). */
    @Test
    @DisplayName("parseDateTimeBound converts offset timestamps to CenterTime.ZONE instead of dropping offset")
    void parseDateTimeBound_ConvertsOffsetToCenterZone() {
        AuditService.ParsedBound parsed = auditService.parseDateTimeBound("2026-10-31T23:59:59Z", true);
        assertThat(parsed.value()).isEqualTo(LocalDateTime.of(2026, 11, 1, 6, 59, 59));
        assertThat(parsed.exclusive()).isFalse();
    }

    /** Kiểm thử P1-BE-43: chuỗi chỉ có ngày cho to dùng đầu ngày kế tiếp với cận trên mở (<) thay vì LocalTime.MAX. */
    @Test
    @DisplayName("parseDateTimeBound uses exclusive next-day start for date-only upper bound")
    void parseDateTimeBound_DateOnlyToUsesExclusiveNextDayStart() {
        AuditService.ParsedBound parsed = auditService.parseDateTimeBound("2026-10-31", true);
        assertThat(parsed.value()).isEqualTo(LocalDateTime.of(2026, 11, 1, 0, 0, 0));
        assertThat(parsed.exclusive()).isTrue();

        var root = org.mockito.Mockito.mock(jakarta.persistence.criteria.Root.class);
        var query = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaQuery.class);
        var cb = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaBuilder.class);
        var createdAtPath = org.mockito.Mockito.mock(jakarta.persistence.criteria.Path.class);
        var ltPred = org.mockito.Mockito.mock(jakarta.persistence.criteria.Predicate.class);
        when(root.get("createdAt")).thenReturn(createdAtPath);
        when(cb.lessThan(createdAtPath, parsed.value())).thenReturn(ltPred);
        when(cb.and(any(jakarta.persistence.criteria.Predicate[].class))).thenReturn(ltPred);

        AuditSpecifications.filter(null, null, null, null, parsed.value(), true).toPredicate(root, query, cb);

        verify(cb).lessThan(createdAtPath, LocalDateTime.of(2026, 11, 1, 0, 0, 0));
        org.mockito.Mockito.verify(cb, org.mockito.Mockito.never()).lessThanOrEqualTo(any(), any(LocalDateTime.class));
    }

    /** Kiểm thử P3-BE-17: từ chối khoảng thời gian from > to, nhưng cho phép cùng ngày. */
    @Test
    @DisplayName("getAuditLogs rejects from > to with 400 BadRequestException and allows same-day range")
    void getAuditLogs_RejectsInvertedDateRange() {
        PageRequest pageable = PageRequest.of(0, 20);
        assertThatThrownBy(() -> auditService.getAuditLogs(null, null, null, "2026-10-10", "2026-10-09", pageable))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> auditService.getAuditLogs(
                null, null, null, "2026-10-10T15:00:00", "2026-10-10T14:59:59", pageable))
                .isInstanceOf(BadRequestException.class);

        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));
        assertThat(auditService.getAuditLogs(null, null, null, "2026-10-10", "2026-10-10", pageable).getContent())
                .isEmpty();
    }

    /** Kiểm thử P2-BE-47: escape ký tự wildcard LIKE (\\, %, _) với ESCAPE '\\', index trên AuditLog và @EntityGraph. */
    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("AuditSpecifications escapes LIKE wildcards and AuditLog defines created_at/user_id indexes and EntityGraph")
    void specifications_EscapeLikeWildcardsAndMetadataIndexesExist() throws Exception {
        assertThat(AuditSpecifications.escapeLike("USER_100%\\TEST")).isEqualTo("USER\\_100\\%\\\\TEST");

        var root = org.mockito.Mockito.mock(jakarta.persistence.criteria.Root.class);
        var query = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaQuery.class);
        var cb = org.mockito.Mockito.mock(jakarta.persistence.criteria.CriteriaBuilder.class);
        var actionPath = org.mockito.Mockito.mock(jakarta.persistence.criteria.Path.class);
        var lowered = org.mockito.Mockito.mock(jakarta.persistence.criteria.Expression.class);
        var pred = org.mockito.Mockito.mock(jakarta.persistence.criteria.Predicate.class);
        when(root.get("action")).thenReturn(actionPath);
        when(cb.lower(actionPath)).thenReturn(lowered);
        when(cb.like(lowered, "%user\\_100\\%\\\\%", '\\')).thenReturn(pred);
        when(cb.and(any(jakarta.persistence.criteria.Predicate[].class))).thenReturn(pred);

        AuditSpecifications.filter(null, null, "USER_100%\\", null, null, false).toPredicate(root, query, cb);
        verify(cb).like(lowered, "%user\\_100\\%\\\\%", '\\');

        var table = AuditLog.class.getAnnotation(jakarta.persistence.Table.class);
        var indexNames = java.util.Arrays.stream(table.indexes()).map(jakarta.persistence.Index::name).toList();
        assertThat(indexNames).contains("ix_audit_entity", "ix_audit_created_at", "ix_audit_user_id");

        var findAllMethod = AuditLogRepository.class.getMethod("findAll", Specification.class, Pageable.class);
        var entityGraph = findAllMethod.getAnnotation(org.springframework.data.jpa.repository.EntityGraph.class);
        assertThat(entityGraph).isNotNull();
        assertThat(entityGraph.attributePaths()).containsExactly("user");
    }
}
