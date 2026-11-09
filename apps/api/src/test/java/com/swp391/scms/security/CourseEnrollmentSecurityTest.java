package com.swp391.scms.security;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.EnrollmentController;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.users.UserRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Recurring-course enroll / checkout / cancel live under /api/v1/classes, where a catch-all matcher reserves writes
 * for the manager. These tests run the real filter chain to prove the member-only matchers are reached first.
 */
@WebMvcTest(EnrollmentController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class CourseEnrollmentSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean EnrollmentService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(10L, "review-user", role),
                null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymousCannotEnrollCheckoutOrCancel() throws Exception {
        mvc.perform(post("/api/v1/classes/5/enroll")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/classes/5/checkout")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/classes/5/enroll")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void staffRolesCannotActAsTheMember() throws Exception {
        for (String role : List.of("RECEPTIONIST", "COACH", "CENTER_MANAGER", "MANAGER")) {
            mvc.perform(post("/api/v1/classes/5/enroll").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/classes/5/checkout").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(delete("/api/v1/classes/5/enroll").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);
    }

    @Test
    void memberReachesEnrollCheckoutAndCancel() throws Exception {
        mvc.perform(post("/api/v1/classes/5/enroll").with(authentication(actor("MEMBER"))))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/classes/5/checkout").with(authentication(actor("MEMBER"))))
                .andExpect(status().isCreated());
        mvc.perform(delete("/api/v1/classes/5/enroll").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());
        verify(service).enrollCourse(any(), eq(5L));
        verify(service).checkoutCourse(any(), eq(5L), eq("cash"));
        verify(service).cancelCourseEnrollment(any(), eq(5L));
    }
}
