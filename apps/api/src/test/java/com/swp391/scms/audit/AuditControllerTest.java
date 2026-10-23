package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.audit.dto.AuditLogDto;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuditControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AuditService auditService;

    @BeforeEach
    void setUp() {
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasename("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        AuditController controller = new AuditController(auditService, messageService);

        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/admin/audit-logs returns 200 with paginated audit logs")
    void getAuditLogs_Success() throws Exception {
        AuditLogDto dto = new AuditLogDto(
                1L,
                10L,
                "Quản lý Trung tâm",
                "manager@solfitness.vn",
                "CREATE_PAYMENT",
                "payments",
                500L,
                null,
                Map.of("amount", 500000, "status", "completed"),
                "127.0.0.1",
                LocalDateTime.of(2026, 10, 22, 10, 0)
        );

        when(auditService.getAuditLogs(isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(dto), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].id").value(1))
                .andExpect(jsonPath("$.data.content[0].userId").value(10))
                .andExpect(jsonPath("$.data.content[0].userFullName").value("Quản lý Trung tâm"))
                .andExpect(jsonPath("$.data.content[0].action").value("CREATE_PAYMENT"))
                .andExpect(jsonPath("$.data.content[0].entityType").value("payments"))
                .andExpect(jsonPath("$.data.content[0].entityId").value(500))
                .andExpect(jsonPath("$.data.content[0].newValue.amount").value(500000));

        verify(auditService).getAuditLogs(isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    @DisplayName("GET /api/v1/admin/audit-logs passes query parameters to service")
    void getAuditLogs_WithQueryParams() throws Exception {
        when(auditService.getAuditLogs(eq(10L), eq("payments"), eq("CREATE"), eq("2026-10-01"), eq("2026-10-31"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("user_id", "10")
                        .param("entity_type", "payments")
                        .param("action", "CREATE")
                        .param("from", "2026-10-01")
                        .param("to", "2026-10-31")
                        .param("page", "0")
                        .param("size", "10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isEmpty());

        verify(auditService).getAuditLogs(eq(10L), eq("payments"), eq("CREATE"), eq("2026-10-01"), eq("2026-10-31"), any(Pageable.class));
    }

    @Test
    @DisplayName("GET /api/v1/admin/audit-logs with invalid date returns 400 Bad Request with i18n error")
    void getAuditLogs_InvalidDateFormat_Returns400() throws Exception {
        when(auditService.getAuditLogs(isNull(), isNull(), isNull(), eq("invalid-date"), isNull(), any(Pageable.class)))
                .thenThrow(new BadRequestException("INVALID_DATE_FORMAT", "audit.invalid_date_format", new Object[]{"invalid-date"}, "Định dạng ngày không hợp lệ: invalid-date"));

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("from", "invalid-date")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_DATE_FORMAT"))
                .andExpect(jsonPath("$.message").value(containsString("invalid-date")));
    }

    @Test
    @DisplayName("Spring context verifies Autowired constructor exists and bean instantiates without NoSuchMethodException")
    void springContextResolvesAutowiredConstructor() {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.getDefaultListableBeanFactory().registerSingleton("auditService", auditService);
        context.register(AuditController.class);
        context.refresh();

        AuditController bean = context.getBean(AuditController.class);
        assertThat(bean).isNotNull();
        context.close();
    }
}
