package com.swp391.scms.health;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.health.dto.HealthMetricCreateDto;
import com.swp391.scms.health.dto.HealthMetricDto;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class HealthMetricControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private HealthMetricService healthMetricService;

    @InjectMocks
    private HealthMetricController healthMetricController;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(101L, "member1", "MEMBER");
        }
    };

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(healthMetricController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/members/{id}/health-metrics returns member health metric list")
    void getMetricsSuccess() throws Exception {
        HealthMetricDto dto = new HealthMetricDto(
                1L, "weight", new BigDecimal("68.5"), "kg", 101L, LocalDateTime.now()
        );
        when(healthMetricService.getMetrics(eq(101L), eq(101L), eq("MEMBER"))).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/members/101/health-metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].metricName").value("weight"))
                .andExpect(jsonPath("$.data[0].metricValue").value(68.5));
    }

    @Test
    @DisplayName("POST /api/v1/members/{id}/health-metrics creates metric and returns 200")
    void addMetricSuccess() throws Exception {
        HealthMetricDto request = new HealthMetricDto(
                null, "weight", new BigDecimal("70.0"), "kg", null, null
        );
        HealthMetricDto created = new HealthMetricDto(
                2L, "weight", new BigDecimal("70.0"), "kg", 101L, LocalDateTime.now()
        );
        when(healthMetricService.addMetric(eq(101L), any(), eq(101L), eq("MEMBER"))).thenReturn(created);

        mockMvc.perform(post("/api/v1/members/101/health-metrics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(2))
                .andExpect(jsonPath("$.data.metricName").value("weight"));
    }

    @Test
    @DisplayName("POST /api/v1/members/{id}/health-metrics returns 400 on zero or negative metric value")
    void addMetricInvalidValue() throws Exception {
        HealthMetricDto request = new HealthMetricDto(
                null, "weight", new BigDecimal("0.00"), "kg", null, null
        );

        mockMvc.perform(post("/api/v1/members/101/health-metrics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/members/{id}/health-metrics/{metricId} updates metric successfully")
    void updateMetricSuccess() throws Exception {
        HealthMetricDto request = new HealthMetricDto(
                null, "weight", new BigDecimal("72.5"), "kg", null, null
        );
        HealthMetricDto updated = new HealthMetricDto(
                5L, "weight", new BigDecimal("72.5"), "kg", 101L, LocalDateTime.now()
        );
        when(healthMetricService.updateMetric(eq(101L), eq(5L), any(), eq(101L), eq("MEMBER"))).thenReturn(updated);

        mockMvc.perform(put("/api/v1/members/101/health-metrics/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.metricValue").value(72.5));
    }

    @Test
    @DisplayName("DELETE /api/v1/members/{id}/health-metrics/{metricId} deletes metric successfully")
    void deleteMetricSuccess() throws Exception {
        doNothing().when(healthMetricService).deleteMetric(eq(101L), eq(5L), eq(101L), eq("MEMBER"));

        mockMvc.perform(delete("/api/v1/members/101/health-metrics/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/health/metrics records metric and returns 200")
    void recordMetricSuccess() throws Exception {
        HealthMetricCreateDto request = new HealthMetricCreateDto(
                101L, "waist", new BigDecimal("76.0"), "cm"
        );
        HealthMetricDto created = new HealthMetricDto(
                3L, "waist", new BigDecimal("76.0"), "cm", 101L, LocalDateTime.now()
        );
        when(healthMetricService.recordMetric(any(), eq(101L), eq("MEMBER"))).thenReturn(created);

        mockMvc.perform(post("/api/v1/health/metrics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.metricName").value("waist"))
                .andExpect(jsonPath("$.data.metricValue").value(76.0));
    }

    @Test
    @DisplayName("GET /api/v1/health/metrics/my returns chronological metrics for Line Chart")
    void getMyMetricsChronologicalSuccess() throws Exception {
        HealthMetricDto m1 = new HealthMetricDto(1L, "weight", new BigDecimal("72.0"), "kg", 101L, LocalDateTime.now().minusDays(7));
        HealthMetricDto m2 = new HealthMetricDto(2L, "weight", new BigDecimal("70.5"), "kg", 101L, LocalDateTime.now());
        when(healthMetricService.getMyMetricsChronological(101L)).thenReturn(List.of(m1, m2));

        mockMvc.perform(get("/api/v1/health/metrics/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].metricValue").value(72.0))
                .andExpect(jsonPath("$.data[1].metricValue").value(70.5));
    }
}
