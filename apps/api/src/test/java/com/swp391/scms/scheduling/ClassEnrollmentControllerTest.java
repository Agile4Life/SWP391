package com.swp391.scms.scheduling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.scheduling.dto.ClassEnrollmentDto;
import com.swp391.scms.scheduling.service.ClassEnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ClassEnrollmentControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ClassEnrollmentService enrollmentService;

    private ClassEnrollmentController controller;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(10L, "member01", "MEMBER");
        }
    };

    @BeforeEach
    void setUp() {
        controller = new ClassEnrollmentController(enrollmentService, null);
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        org.springframework.http.converter.json.MappingJackson2HttpMessageConverter converter =
                new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(mapper);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(converter)
                .setCustomArgumentResolvers(principalResolver)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/classes/enrollments/my should return 200 OK with enrollment list")
    void shouldReturnMyEnrollmentsSuccessfully() throws Exception {
        ClassEnrollmentDto dto = new ClassEnrollmentDto(
                1L,
                5L,
                "Yoga Vinyasa",
                "Nguyễn Văn Coach",
                "Studio A",
                LocalDate.of(2026, 10, 15),
                LocalTime.of(8, 0),
                LocalTime.of(9, 30),
                "booked",
                LocalDateTime.of(2026, 10, 12, 8, 0),
                null,
                null
        );

        when(enrollmentService.getMyEnrollments(any(AuthenticatedPrincipal.class), isNull(), isNull()))
                .thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/classes/enrollments/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].classId").value(5))
                .andExpect(jsonPath("$.data[0].className").value("Yoga Vinyasa"))
                .andExpect(jsonPath("$.data[0].coachName").value("Nguyễn Văn Coach"))
                .andExpect(jsonPath("$.data[0].roomName").value("Studio A"))
                .andExpect(jsonPath("$.data[0].sessionDate").value("2026-10-15"))
                .andExpect(jsonPath("$.data[0].startTime").value("08:00:00"))
                .andExpect(jsonPath("$.data[0].endTime").value("09:30:00"))
                .andExpect(jsonPath("$.data[0].status").value("booked"));

        verify(enrollmentService).getMyEnrollments(any(AuthenticatedPrincipal.class), isNull(), isNull());
    }

    @Test
    @DisplayName("GET /api/v1/classes/enrollments/my with status and upcoming filter should pass params")
    void shouldPassFilterParams() throws Exception {
        when(enrollmentService.getMyEnrollments(any(AuthenticatedPrincipal.class), eq("booked"), eq(true)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/classes/enrollments/my")
                        .param("status", "booked")
                        .param("upcoming", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        verify(enrollmentService).getMyEnrollments(any(AuthenticatedPrincipal.class), eq("booked"), eq(true));
    }
}
