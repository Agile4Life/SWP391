package com.swp391.scms.scheduling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.CoachAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.RecurringAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.RoomAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.SlotAvailabilityDto;
import com.swp391.scms.scheduling.service.ClassService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bộ kiểm thử cho controller ClassController (class controller). */
@ExtendWith(MockitoExtension.class)
class ClassControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ClassService classService;

    private ClassController controller;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private static final LocalDate FIXED_DATE = LocalDate.of(2026, 11, 26);

    /** Chuẩn bị trước mỗi test: dựng MockMvc cho controller lớp học. */
    @BeforeEach
    void setUp() {
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        controller = new ClassController(classService, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
    }

    /** Kiểm thử: tạo lớp lẻ đã ngừng, được thay bằng khóa học định kỳ. */
    @Test
    void createClass_isRetiredInFavourOfRecurringCourses() throws Exception {
        CreateClassRequest request = new CreateClassRequest(
                "Yoga Cơ Bản", 1L, 2L, 3L, 20, "beginner", "Lớp học yoga cho người mới"
        );
        mockMvc.perform(post("/api/v1/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SCHEDULING_SINGLE_SESSION_DISABLED"));
        org.mockito.Mockito.verify(classService, org.mockito.Mockito.never()).createClass(any());
    }

    /** Kiểm thử: từ chối cấp độ không hỗ trợ trước khi lưu dữ liệu. */
    @Test
    void createClass_rejectsUnsupportedLevelBeforePersistence() throws Exception {
        CreateClassRequest request = new CreateClassRequest("Yoga", 1L, 2L, 3L, 20, "expert", null);

        mockMvc.perform(post("/api/v1/classes")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.level").value("Level must be beginner, intermediate, advanced or all"));
        verifyNoInteractions(classService);
    }

    /** Kiểm thử: tạo buổi học trả 201 Created. */
    @Test
    void createSession_returnsCreated() throws Exception {
        LocalDate sessionDate = FIXED_DATE.plusDays(1);
        CreateSessionRequest request = new CreateSessionRequest(
                sessionDate, LocalTime.of(8, 0), LocalTime.of(9, 30)
        );
        ClassSessionDto dto = new ClassSessionDto(
                10L, 1L, "Yoga Cơ Bản", 1L, "Yoga", 2L, "Coach Name", 3L, "Phòng 101",
                sessionDate, LocalTime.of(8, 0), LocalTime.of(9, 30),
                "scheduled", null, 20, 0L
        );
        when(classService.createSession(eq(1L), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/classes/1/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(10L))
                .andExpect(jsonPath("$.data.status").value("scheduled"));
    }

    /** Kiểm thử: liệt kê buổi học trả 200 OK. */
    @Test
    void listSessions_returnsOk() throws Exception {
        ClassSessionDto dto = new ClassSessionDto(
                10L, 1L, "Yoga Cơ Bản", 1L, "Yoga", 2L, "Coach Name", 3L, "Phòng 101",
                FIXED_DATE.plusDays(1), LocalTime.of(8, 0), LocalTime.of(9, 30),
                "scheduled", null, 20, 0L
        );
        when(classService.searchSessions(any(), any(), any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/classes/sessions")
                        .param("fromDate", FIXED_DATE.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(10L));
    }

    /** Kiểm thử: HLV chỉ thấy buổi của mình dù yêu cầu xem HLV khác. */
    @Test
    void listSessions_coachOnlySeesOwnSessionsEvenWhenAskingForAnotherCoach() throws Exception {
        com.swp391.scms.security.AuthenticatedPrincipal coach =
                new com.swp391.scms.security.AuthenticatedPrincipal(7L, "coach@test.com", "COACH");
        MockMvc coachMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new org.springframework.web.method.support.HandlerMethodArgumentResolver() {
                    /** Bộ phân giải tham số giả của test: cho biết có hỗ trợ tham số này không. */
                    @Override
                    public boolean supportsParameter(org.springframework.core.MethodParameter parameter) {
                        return parameter.hasParameterAnnotation(
                                org.springframework.security.core.annotation.AuthenticationPrincipal.class);
                    }

                    /** Bộ phân giải tham số giả của test: cấp principal đã đăng nhập cho tham số controller. */
                    @Override
                    public Object resolveArgument(org.springframework.core.MethodParameter parameter,
                                                  org.springframework.web.method.support.ModelAndViewContainer mavContainer,
                                                  org.springframework.web.context.request.NativeWebRequest webRequest,
                                                  org.springframework.web.bind.support.WebDataBinderFactory binderFactory) {
                        return coach;
                    }
                })
                .build();
        when(classService.searchSessions(any(), any(), any(), any())).thenReturn(List.of());

        coachMvc.perform(get("/api/v1/classes/sessions").param("coachId", "99"))
                .andExpect(status().isOk());

        org.mockito.Mockito.verify(classService).searchSessions(null, null, null, 7L);
    }

    /** Kiểm thử: liệt kê lớp học trả 200 OK. */
    @Test
    void listClasses_returnsOk() throws Exception {
        GymClassDto dto = new GymClassDto(
                1L, "Yoga Cơ Bản", 1L, "Yoga", 2L, "Coach Name", 3L, "Phòng 101", 20, "beginner", "Lớp học yoga cho người mới", "active"
        );
        when(classService.listClasses()).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/classes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(1L));
    }

    /** Kiểm thử: POST /recurring/availability trả 200 OK kèm thông tin khả dụng của 5 slot, phòng và HLV. */
    @Test
    void checkRecurringAvailability_returnsOk() throws Exception {
        RecurringAvailabilityRequest request = new RecurringAvailabilityRequest(
                1L,
                LocalDate.of(2026, 11, 30),
                LocalDate.of(2026, 12, 13),
                List.of("MONDAY", "WEDNESDAY"),
                LocalTime.of(7, 0),
                LocalTime.of(9, 30)
        );
        RecurringAvailabilityDto response = new RecurringAvailabilityDto(
                true,
                null,
                null,
                4,
                LocalDate.of(2026, 11, 30),
                LocalDate.of(2026, 12, 9),
                true,
                null,
                null,
                List.of(new SlotAvailabilityDto(
                        1, "SLOT_1", LocalTime.of(7, 0), LocalTime.of(9, 30),
                        true, false, null, null, 2, 3)),
                List.of(new RoomAvailabilityDto(
                        3L, "Zen Garden Studio", "Tầng 2", 16, "STANDARD", true, null, null)),
                List.of(new CoachAvailabilityDto(
                        2L, "Coach An", "an@sol.vn", true, null, null))
        );
        when(classService.checkRecurringAvailability(any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/classes/recurring/availability")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Schedule availability checked successfully"))
                .andExpect(jsonPath("$.data.validSchedule").value(true))
                .andExpect(jsonPath("$.data.sessionCount").value(4))
                .andExpect(jsonPath("$.data.slots[0].code").value("SLOT_1"))
                .andExpect(jsonPath("$.data.rooms[0].name").value("Zen Garden Studio"))
                .andExpect(jsonPath("$.data.coaches[0].fullName").value("Coach An"));
    }

    /** Kiểm thử P0-05: PUT /classes/{id} từ chối status=cancelled và chấp nhận status=inactive. */
    @Test
    void updateClass_rejectsCancelledAndAcceptsInactiveStatus() throws Exception {
        var invalidReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.UpdateClassRequest(
                "Yoga Flow", 1L, 2L, 3L, 15, "all", null, "cancelled");

        mockMvc.perform(put("/api/v1/classes/1")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.status").value("Class status must be active, inactive or archived"));
        verifyNoInteractions(classService);

        var validReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.UpdateClassRequest(
                "Yoga Flow", 1L, 2L, 3L, 15, "all", null, "inactive");
        GymClassDto updated = new GymClassDto(
                1L, "Yoga Flow", 1L, "Yoga", 2L, "Coach", 3L, "Room", 15, "all", null, "inactive");
        when(classService.updateClass(eq(1L), any())).thenReturn(updated);

        mockMvc.perform(put("/api/v1/classes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("inactive"));
    }
}
