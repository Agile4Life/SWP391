package com.swp391.scms.attendance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.attendance.dto.BatchAttendanceRequest;
import com.swp391.scms.attendance.dto.BatchAttendanceRequest.AttendanceItem;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse.MemberAttendanceItem;
import com.swp391.scms.attendance.service.SessionAttendanceService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SessionAttendanceControllerTest {

    @Mock
    private SessionAttendanceService service;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private AuthenticatedPrincipal coachPrincipal;

    @BeforeEach
    void setUp() {
        coachPrincipal = new AuthenticatedPrincipal(10L, "coach@test.com", "COACH");
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();

        SessionAttendanceController controller = new SessionAttendanceController(service);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    @Override
                    public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
                    }

                    @Override
                    public Object resolveArgument(MethodParameter parameter,
                                                  ModelAndViewContainer mavContainer,
                                                  NativeWebRequest webRequest,
                                                  WebDataBinderFactory binderFactory) {
                        return coachPrincipal;
                    }
                })
                .build();
    }

    @Test
    void getSessionAttendanceRoster_returnsOk() throws Exception {
        SessionAttendanceResponse response = new SessionAttendanceResponse(
                100L, 5L, "Yoga", LocalDate.of(2026, 10, 25),
                LocalTime.of(9, 0), LocalTime.of(10, 0),
                10L, "Coach John", "Studio 1",
                1, 1, 0, 0, 0,
                List.of(new MemberAttendanceItem(
                        20L, "MEM-20", "Jane Doe", "jane@test.com", "0123456789", null,
                        "booked", "present", LocalDateTime.of(2026, 10, 25, 9, 2),
                        10L, "Coach John", "Good"
                ))
        );

        when(service.getSessionAttendanceRoster(100L)).thenReturn(response);

        mockMvc.perform(get("/api/v1/attendance/sessions/100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").value(100))
                .andExpect(jsonPath("$.data.className").value("Yoga"))
                .andExpect(jsonPath("$.data.members[0].fullName").value("Jane Doe"))
                .andExpect(jsonPath("$.data.members[0].attendanceStatus").value("present"));
    }

    @Test
    void recordBatchAttendance_validPayload_returnsOk() throws Exception {
        BatchAttendanceRequest request = new BatchAttendanceRequest(List.of(
                new AttendanceItem(20L, "present", "Arrived early")
        ));

        List<MemberAttendanceItem> result = List.of(new MemberAttendanceItem(
                20L, "MEM-20", "Jane Doe", "jane@test.com", "0123456789", null,
                "booked", "present", LocalDateTime.of(2026, 10, 25, 9, 0),
                10L, "Coach John", "Arrived early"
        ));

        when(service.recordBatchAttendance(eq(100L), any(BatchAttendanceRequest.class), any(AuthenticatedPrincipal.class)))
                .thenReturn(result);

        mockMvc.perform(post("/api/v1/attendance/sessions/100/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].memberId").value(20))
                .andExpect(jsonPath("$.data[0].attendanceStatus").value("present"));
    }
}
