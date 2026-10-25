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

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    private ObjectMapper objectMapper;
    private AuditService auditService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        auditService = new AuditService(auditLogRepository, objectMapper);
    }

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

        // Verify JSON is parsed into JsonNode tree structure
        assertThat(dto.oldValue()).isInstanceOf(JsonNode.class);
        assertThat(((JsonNode) dto.oldValue()).get("status").asText()).isEqualTo("pending_payment");
        assertThat(dto.newValue()).isInstanceOf(JsonNode.class);
        assertThat(((JsonNode) dto.newValue()).get("status").asText()).isEqualTo("active");

        verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
    }

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

    @Test
    @DisplayName("getAuditLogs with invalid from date throws BadRequestException HTTP 400")
    void getAuditLogs_InvalidFromDate_ThrowsBadRequestException() {
        PageRequest pageable = PageRequest.of(0, 20);
        assertThatThrownBy(() -> auditService.getAuditLogs(null, null, null, "invalid-date", null, pageable))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("invalid-date");
    }

    @Test
    @DisplayName("getAuditLogs with invalid to date throws BadRequestException HTTP 400")
    void getAuditLogs_InvalidToDate_ThrowsBadRequestException() {
        PageRequest pageable = PageRequest.of(0, 20);
        assertThatThrownBy(() -> auditService.getAuditLogs(null, null, null, null, "2026-99-99", pageable))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("2026-99-99");
    }

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
}
