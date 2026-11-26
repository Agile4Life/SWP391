package com.swp391.scms.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.MembershipCancellationController;
import com.swp391.scms.membership.service.MembershipCancellationService;
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
 * Kiểm thử HTTP/Security cho MembershipCancellationController (/api/v1/memberships/cancellations/**):
 * phân tách quyền hội viên (/my), quầy lễ tân + quản lý (/staff-request, GET /) và quyền duyệt/từ chối
 * độc quyền của CENTER_MANAGER.
 */
@WebMvcTest(controllers = MembershipCancellationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class MembershipCancellationControllerSecurityTest {

    private static final String STAFF_REQUEST_BODY = """
            {
              "memberId": 20,
              "subscriptionId": 30,
              "reason": "Hoi vien chuyen cong tac xa",
              "refundAmount": 250000
            }
            """;
    private static final String DECISION_BODY = "{\"note\":\"Da doi soat\",\"refundAmount\":200000}";

    @Autowired MockMvc mvc;
    @MockitoBean MembershipCancellationService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Người chưa đăng nhập nhận 401 ở mọi endpoint yêu cầu hủy gói. */
    @Test
    void anonymousCannotAccessAnyCancellationEndpoint() throws Exception {
        mvc.perform(get("/api/v1/memberships/cancellations/my")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/cancellations/staff-request")
                        .contentType(MediaType.APPLICATION_JSON).content(STAFF_REQUEST_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/memberships/cancellations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/cancellations/15/approve")
                        .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/cancellations/15/reject")
                        .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    /** GET /my chỉ dành cho MEMBER; mọi vai trò nhân sự/quản trị nhận 403. */
    @Test
    void memberCancellationHistoryAllowsOnlyMember() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "COACH", "CENTER_MANAGER", "MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/memberships/cancellations/my").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);

        mvc.perform(get("/api/v1/memberships/cancellations/my").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());
        verify(service).mine(any());
    }

    /** Tạo yêu cầu thay hội viên và xem danh sách hủy chỉ cho phép RECEPTIONIST và CENTER_MANAGER; chặn MEMBER/STAFF/COACH/ADMIN. */
    @Test
    void staffRequestAndListAllowOnlyReceptionistAndCenterManager() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "COACH", "MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/memberships/cancellations/staff-request").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(STAFF_REQUEST_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/memberships/cancellations").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);

        for (String role : List.of("RECEPTIONIST", "CENTER_MANAGER")) {
            mvc.perform(post("/api/v1/memberships/cancellations/staff-request").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(STAFF_REQUEST_BODY))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/v1/memberships/cancellations").with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(service, times(2)).staffRequest(any(), any());
        verify(service, times(2)).all();
    }

    /** Phê duyệt và từ chối hủy gói là quyền riêng của CENTER_MANAGER; lễ tân, STAFF và hội viên đều nhận 403. */
    @Test
    void approveAndRejectAllowOnlyCenterManager() throws Exception {
        for (String role : List.of("MEMBER", "RECEPTIONIST", "STAFF", "COACH", "MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/memberships/cancellations/15/approve").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/memberships/cancellations/15/reject").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);

        mvc.perform(post("/api/v1/memberships/cancellations/15/approve").with(authentication(actor("CENTER_MANAGER")))
                        .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/memberships/cancellations/15/reject").with(authentication(actor("CENTER_MANAGER")))
                        .contentType(MediaType.APPLICATION_JSON).content(DECISION_BODY))
                .andExpect(status().isOk());
        verify(service).decide(any(), eq(15L), eq(true), any());
        verify(service).decide(any(), eq(15L), eq(false), any());
    }
}
