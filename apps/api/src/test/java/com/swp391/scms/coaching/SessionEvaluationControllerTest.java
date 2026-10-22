package com.swp391.scms.coaching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.coaching.dto.SessionEvaluationCreateDto;
import com.swp391.scms.coaching.dto.SessionEvaluationDto;
import com.swp391.scms.coaching.service.SessionEvaluationService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SessionEvaluationControllerTest {

    @Mock
    private SessionEvaluationService evaluationService;

    @Mock
    private MessageService messageService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        lenient().when(messageService.getMessage(any())).thenAnswer(inv -> inv.getArgument(0));
        SessionEvaluationController controller = new SessionEvaluationController(evaluationService, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Test
    void createEvaluation_Returns201() throws Exception {
        SessionEvaluationDto dto = new SessionEvaluationDto(
                10L, 5L, 101L, "MEM-101", 202L,
                "Kỹ thuật tốt", new BigDecimal("85.0"), "Duy trì tiến độ",
                LocalDateTime.now(), LocalDateTime.now()
        );
        when(evaluationService.createEvaluation(any(), any(), any())).thenReturn(dto);

        SessionEvaluationCreateDto req = new SessionEvaluationCreateDto(
                5L, 101L, 202L, new BigDecimal("85.0"), "Kỹ thuật tốt", "Duy trì tiến độ", null
        );

        mockMvc.perform(post("/api/v1/coaching/evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(10))
                .andExpect(jsonPath("$.data.progressScore").value(85.0));
    }

    @Test
    void createEvaluation_WhenScoreExceeds100_Returns400() throws Exception {
        SessionEvaluationCreateDto req = new SessionEvaluationCreateDto(
                5L, 101L, 202L, new BigDecimal("120.0"), "Kỹ thuật tốt", "Duy trì tiến độ", null
        );

        mockMvc.perform(post("/api/v1/coaching/evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getMyEvaluations_Returns200() throws Exception {
        SessionEvaluationDto dto = new SessionEvaluationDto(
                10L, 5L, 101L, "MEM-101", 202L,
                "Kỹ thuật tốt", new BigDecimal("90.0"), "Xuất sắc",
                LocalDateTime.now(), LocalDateTime.now()
        );
        when(evaluationService.getMyEvaluations(any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/coaching/evaluations/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].progressScore").value(90.0));
    }
}
