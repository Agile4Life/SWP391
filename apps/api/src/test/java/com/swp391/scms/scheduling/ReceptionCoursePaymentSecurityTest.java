package com.swp391.scms.scheduling;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.security.JsonAccessDeniedHandler;
import com.swp391.scms.security.JsonAuthenticationEntryPoint;
import com.swp391.scms.security.JwtAuthenticationFilter;
import com.swp391.scms.security.JwtService;
import com.swp391.scms.security.SecurityConfig;
import com.swp391.scms.users.UserRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Kiểm thử chuỗi bảo mật thật cho hai endpoint quầy lễ tân thu học phí khóa học ({@code /enrollments/unpaid}
 * và {@code /enrollments/{id}/confirm-payment}) dưới {@code /api/v1/classes/**}.
 */
@WebMvcTest(controllers = EnrollmentController.class, properties = "app.legacy.classes-enabled=true")
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class ReceptionCoursePaymentSecurityTest {

    @Autowired MockMvc mvc;
    @MockitoBean EnrollmentService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "desk-user", role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    @Test
    void anonymousCannotAccessUnpaidOrConfirmPayment() throws Exception {
        mvc.perform(get("/api/v1/classes/enrollments/unpaid")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/classes/enrollments/5/confirm-payment")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void nonDeskRolesCannotAccessUnpaidOrConfirmPayment() throws Exception {
        for (String role : List.of("MEMBER", "COACH", "MANAGER", "STAFF")) {
            mvc.perform(get("/api/v1/classes/enrollments/unpaid").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/classes/enrollments/5/confirm-payment").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);
    }

    @Test
    void receptionistAndCenterManagerReachUnpaidAndConfirmPayment() throws Exception {
        when(service.listUnpaidCourseEnrollments()).thenReturn(List.of());
        when(service.confirmCourseEnrollmentPayment(any(), eq(5L), eq("cash"))).thenReturn(new PaymentDto());

        for (String role : List.of("RECEPTIONIST", "CENTER_MANAGER")) {
            mvc.perform(get("/api/v1/classes/enrollments/unpaid").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/classes/enrollments/5/confirm-payment")
                            .with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"method\":\"cash\"}"))
                    .andExpect(status().isOk());
        }

        verify(service, org.mockito.Mockito.times(2)).listUnpaidCourseEnrollments();
        verify(service, org.mockito.Mockito.times(2)).confirmCourseEnrollmentPayment(any(), eq(5L), eq("cash"));
    }
}
