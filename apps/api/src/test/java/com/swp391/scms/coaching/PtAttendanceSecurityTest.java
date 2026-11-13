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

/** Real production security chain with mock services. No Boot startup, dotenv, database or real account. */
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
