package com.swp391.scms.coaching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.security.*;
import com.swp391.scms.users.UserRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Bộ kiểm thử cho PtAttendanceSecurity.
 * Kiểm thử chuỗi bảo mật thật của môi trường production với các service giả lập; không khởi chạy Spring Boot, dotenv, cơ sở dữ liệu hay tài khoản thật.
 */
class PtAttendanceSecurityTest {
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    CoachBookingService service;

    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(TestConfiguration.class);
        context.refresh();
        service = context.getBean(CoachBookingService.class);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }
    @AfterEach void close() { context.close(); }
    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (actor). */
    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(2L, "mock-actor", role),
                null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test void receptionistCanReachAttendanceAndBothMutations() throws Exception {
        mvc.perform(get("/api/v1/coach-bookings/attendance").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/coach-bookings/11/unmark-attended").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        mvc.perform(post("/api/v1/coach-bookings/11/mark-attended").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        verify(service).unmarkAttended(new AuthenticatedPrincipal(2L, "mock-actor", "RECEPTIONIST"), 11L);
    }

    @Test void anonymousAndMemberCannotUnmark() throws Exception {
        mvc.perform(post("/api/v1/coach-bookings/11/unmark-attended"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/coach-bookings/11/unmark-attended").with(authentication(actor("MEMBER"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void domainPermissionFailuresStay403() throws Exception {
        when(service.unmarkAttended(any(), eq(11L))).thenThrow(new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Denied"));
        mvc.perform(post("/api/v1/coach-bookings/11/unmark-attended").with(authentication(actor("COACH"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    /** Kiểm thử P2-BE-26: toàn bộ 12 endpoint có @PreAuthorize; /coach-schedule cho phép CENTER_MANAGER lọc theo coachId còn COACH chỉ xem của mình. */
    @Test void allTwelveEndpointsDeclarePreAuthorizeAndCoachScheduleSupportsManagerCoachId() throws Exception {
        long annotatedEndpoints = java.util.Arrays.stream(CoachBookingController.class.getDeclaredMethods())
                .filter(m -> m.isAnnotationPresent(org.springframework.web.bind.annotation.GetMapping.class)
                        || m.isAnnotationPresent(org.springframework.web.bind.annotation.PostMapping.class)
                        || m.isAnnotationPresent(org.springframework.web.bind.annotation.DeleteMapping.class))
                .peek(m -> org.junit.jupiter.api.Assertions.assertNotNull(
                        m.getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class),
                        "Missing @PreAuthorize on " + m.getName()))
                .count();
        org.junit.jupiter.api.Assertions.assertEquals(12, annotatedEndpoints);

        when(service.getCoachSchedule(anyLong())).thenReturn(List.of());
        mvc.perform(get("/api/v1/coach-bookings/coach-schedule").param("coachId", "20")
                        .with(authentication(actor("CENTER_MANAGER"))))
                .andExpect(status().isOk());
        verify(service).getCoachSchedule(20L);

        mvc.perform(get("/api/v1/coach-bookings/coach-schedule").param("coachId", "99")
                        .with(authentication(actor("COACH"))))
                .andExpect(status().isOk());
        verify(service).getCoachSchedule(2L);
        verify(service, never()).getCoachSchedule(99L);
    }

    /** Bộ kiểm thử cho TestConfiguration (test configuration). */
    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfiguration {
        @Bean CoachBookingService service() { return mock(CoachBookingService.class); }
        @Bean CoachBookingController controller(CoachBookingService service) { return new CoachBookingController(service, null); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
        @Bean JwtAuthenticationFilter jwtFilter() { return new JwtAuthenticationFilter(mock(JwtService.class), mock(UserRepository.class)); }
        @Bean JsonAuthenticationEntryPoint entryPoint() { return new JsonAuthenticationEntryPoint(new ObjectMapper().findAndRegisterModules(), null); }
        @Bean JsonAccessDeniedHandler deniedHandler() { return new JsonAccessDeniedHandler(new ObjectMapper().findAndRegisterModules(), null); }
    }
}
