package com.swp391.scms.coaching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.coaching.dto.TrainingPlanCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemDto;
import com.swp391.scms.coaching.service.TrainingPlanService;
import com.swp391.scms.common.GlobalExceptionHandler;
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

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class TrainingPlanControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private TrainingPlanService trainingPlanService;

    @InjectMocks
    private TrainingPlanController trainingPlanController;

    private AuthenticatedPrincipal currentPrincipal = new AuthenticatedPrincipal(20L, "coach1", "COACH");

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return currentPrincipal;
            }
        };
        mockMvc = MockMvcBuilders.standaloneSetup(trainingPlanController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("POST /api/v1/coaching/training-plans should return 201 Created in draft status")
    void shouldCreateTrainingPlan() throws Exception {
        TrainingPlanDto response = new TrainingPlanDto();
        response.setId(100L);
        response.setMemberId(10L);
        response.setCoachId(20L);
        response.setGoal("Tăng sức bền");
        response.setStatus("draft");
        response.setItems(List.of(new TrainingPlanItemDto(1L, 100L, 1, "Burpees", "3 hiệp", 3, 15, 10, 1)));

        when(trainingPlanService.createPlan(any(TrainingPlanCreateDto.class), eq(20L), eq("COACH")))
                .thenReturn(response);

        TrainingPlanCreateDto request = new TrainingPlanCreateDto();
        request.setMemberId(10L);
        request.setGoal("Tăng sức bền");
        request.setStartDate(LocalDate.of(2026, 10, 20));
        request.setEndDate(LocalDate.of(2026, 11, 20));
        request.setItems(List.of(new TrainingPlanItemCreateDto(1, "Burpees", "3 hiệp", 3, 15, 10, 1)));

        mockMvc.perform(post("/api/v1/coaching/training-plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(100))
                .andExpect(jsonPath("$.data.status").value("draft"))
                .andExpect(jsonPath("$.data.items[0].exerciseName").value("Burpees"));
    }

    @Test
    @DisplayName("PUT /api/v1/coaching/training-plans/{id}/activate should return 200 OK with active status")
    void shouldActivateTrainingPlan() throws Exception {
        TrainingPlanDto response = new TrainingPlanDto();
        response.setId(100L);
        response.setStatus("active");

        when(trainingPlanService.activatePlan(100L, 20L, "COACH")).thenReturn(response);

        mockMvc.perform(put("/api/v1/coaching/training-plans/100/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("active"));
    }

    @Test
    @DisplayName("GET /api/v1/coaching/training-plans/my should return member active training plans")
    void shouldGetMyActivePlans() throws Exception {
        currentPrincipal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");

        TrainingPlanDto activePlan = new TrainingPlanDto();
        activePlan.setId(100L);
        activePlan.setMemberId(10L);
        activePlan.setStatus("active");
        activePlan.setGoal("Giảm mỡ bụng");

        when(trainingPlanService.getMyActivePlans(10L)).thenReturn(List.of(activePlan));

        mockMvc.perform(get("/api/v1/coaching/training-plans/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(100))
                .andExpect(jsonPath("$.data[0].status").value("active"));
    }
}

