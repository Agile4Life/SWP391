package com.swp391.scms.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.health.HealthController;
import com.swp391.scms.membership.MemberTrialController;
import com.swp391.scms.membership.MembershipRealtimeController;
import com.swp391.scms.membership.MembershipRequestHistoryController;
import com.swp391.scms.membership.ReceptionTrialController;
import com.swp391.scms.membership.service.MemberTrialService;
import com.swp391.scms.membership.service.MembershipRealtimeService;
import com.swp391.scms.membership.service.MembershipRequestHistoryService;
import com.swp391.scms.operations.StaffInternalRequestController;
import com.swp391.scms.operations.service.StaffInternalRequestService;
import com.swp391.scms.reception.MemberLookupController;
import com.swp391.scms.reception.MemberLookupService;
import com.swp391.scms.users.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Kiểm thử HTTP/Security cho nhóm lễ tân & vận hành: MemberTrialController, ReceptionTrialController,
 * StaffInternalRequestController, MemberLookupController, MembershipRequestHistoryController,
 * MembershipRealtimeController và HealthController (/api/v1/health).
 */
@WebMvcTest(controllers = {
        MemberTrialController.class,
        ReceptionTrialController.class,
        StaffInternalRequestController.class,
        MemberLookupController.class,
        MembershipRequestHistoryController.class,
        MembershipRealtimeController.class,
        HealthController.class
})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class ReceptionAndOperationsSecurityTest {

    private static final String TRIAL_CLAIM_BODY = """
            {
              "documentType": "CCCD",
              "documentNumber": "012345678901",
              "fullName": "Nguyen Van A"
            }
            """;
    private static final String TRIAL_REJECT_BODY = "{\"reason\":\"Anh CCCD mo\"}";
    private static final String INTERNAL_REQUEST_BODY = """
            {
              "requestType": "LEAVE",
              "title": "Xin nghi phep",
              "reason": "Viec gia dinh",
              "startDate": "2026-12-05",
              "endDate": "2026-12-06"
            }
            """;
    private static final String INTERNAL_REVIEW_BODY = "{\"status\":\"APPROVED\",\"managerNotes\":\"Dong y\"}";

    @Autowired MockMvc mvc;
    @MockitoBean MemberTrialService trialService;
    @MockitoBean StaffInternalRequestService internalRequestService;
    @MockitoBean MemberLookupService lookupService;
    @MockitoBean MembershipRequestHistoryService requestHistoryService;
    @MockitoBean MembershipRealtimeService realtimeService;
    @MockitoBean ApplicationAvailability availability;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    @BeforeEach
    void setupHealthAvailability() {
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
    }

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Endpoint /api/v1/health mở công khai (permitAll) và trả 200 UP khi dịch vụ sẵn sàng. */
    @Test
    void healthEndpointAllowsAnonymousAndAuthenticatedAndReturnsUp() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("scms-api"));
        mvc.perform(get("/api/v1/health").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    /** Mọi endpoint lễ tân, đơn nội bộ, gói trải nghiệm, tra cứu, lịch sử và realtime đều chặn 401 khi chưa đăng nhập. */
    @Test
    void anonymousCannotAccessProtectedReceptionAndOperationsEndpoints() throws Exception {
        mvc.perform(get("/api/v1/memberships/trial/status")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/trial/request")
                        .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/trial/claim")
                        .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/memberships/trial/requests")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/trial/requests/5/approve")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/trial/requests/5/reject")
                        .contentType(MediaType.APPLICATION_JSON).content(TRIAL_REJECT_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/reception/trials")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/operations/requests")
                        .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REQUEST_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/operations/requests/my")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/operations/requests/5/cancel")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/operations/requests")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/operations/requests/5/review")
                        .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REVIEW_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/members/lookup").param("q", "nguyen")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/memberships/subscriptions/requests/history")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/subscriptions/requests/history")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/memberships/subscriptions/realtime-session")).andExpect(status().isUnauthorized());
        verifyNoInteractions(trialService, internalRequestService, lookupService, requestHistoryService, realtimeService);
    }

    /** Hội viên đăng ký và xem trạng thái gói trải nghiệm; các vai trò nhân sự và Admin nhận 403. */
    @Test
    void memberTrialEndpointsAllowOnlyMember() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "COACH", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/memberships/trial/status").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/memberships/trial/request").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/memberships/trial/claim").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(trialService);

        mvc.perform(get("/api/v1/memberships/trial/status").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/memberships/trial/request").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/memberships/trial/claim").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(TRIAL_CLAIM_BODY))
                .andExpect(status().isCreated());
        verify(trialService).getTrialStatus(10L);
        verify(trialService, times(2)).requestTrial(any(), any());
    }

    /** Hồi quy P1-BE-03: duyệt/từ chối đơn dùng thử (/memberships/trial/requests/** & /reception/trials/**) cho phép RECEPTIONIST/CENTER_MANAGER/ADMIN và chặn MEMBER/STAFF/COACH. */
    @Test
    void trialApprovalEndpointsAllowReceptionistManagerAdminAndForbidMember() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "COACH")) {
            for (String base : List.of("/api/v1/memberships/trial/requests", "/api/v1/reception/trials")) {
                mvc.perform(get(base).with(authentication(actor(role))))
                        .andExpect(status().isForbidden());
                mvc.perform(post(base + "/5/approve").with(authentication(actor(role))))
                        .andExpect(status().isForbidden());
                mvc.perform(post(base + "/5/reject").with(authentication(actor(role)))
                                .contentType(MediaType.APPLICATION_JSON).content(TRIAL_REJECT_BODY))
                        .andExpect(status().isForbidden());
            }
        }
        verifyNoInteractions(trialService);

        List<String> allowed = List.of("RECEPTIONIST", "CENTER_MANAGER", "ADMIN");
        for (String role : allowed) {
            for (String base : List.of("/api/v1/memberships/trial/requests", "/api/v1/reception/trials")) {
                mvc.perform(get(base).with(authentication(actor(role))))
                        .andExpect(status().isOk());
                mvc.perform(post(base + "/5/approve").with(authentication(actor(role))))
                        .andExpect(status().isOk());
                mvc.perform(post(base + "/5/reject").with(authentication(actor(role)))
                                .contentType(MediaType.APPLICATION_JSON).content(TRIAL_REJECT_BODY))
                        .andExpect(status().isOk());
            }
        }
        verify(trialService, times(allowed.size() * 2)).listTrials(isNull(), isNull());
        verify(trialService, times(allowed.size() * 2)).approveTrial(any(), eq(5L));
        verify(trialService, times(allowed.size() * 2)).rejectTrial(any(), eq(5L), eq("Anh CCCD mo"));
    }

    /** Đơn nội bộ: STAFF/COACH/RECEPTIONIST được tạo, xem /my và hủy đơn; quản lý/hội viên/admin bị chặn 403. */
    @Test
    void staffInternalRequestSubmissionAllowsStaffCoachReceptionistOnly() throws Exception {
        for (String role : List.of("MEMBER", "CENTER_MANAGER", "MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/operations/requests").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REQUEST_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/operations/requests/my").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/operations/requests/5/cancel").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(internalRequestService);

        List<String> allowed = List.of("STAFF", "COACH", "RECEPTIONIST");
        for (String role : allowed) {
            mvc.perform(post("/api/v1/operations/requests").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REQUEST_BODY))
                    .andExpect(status().isCreated());
            mvc.perform(get("/api/v1/operations/requests/my").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(put("/api/v1/operations/requests/5/cancel").with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(internalRequestService, times(allowed.size())).createRequest(eq(10L), any());
        verify(internalRequestService, times(allowed.size())).getMyRequests(eq(10L), isNull());
        verify(internalRequestService, times(allowed.size())).cancelRequest(10L, 5L);
    }

    /** Duyệt và xem toàn bộ đơn nội bộ chỉ dành cho CENTER_MANAGER và MANAGER; STAFF/COACH/RECEPTIONIST/MEMBER/ADMIN nhận 403. */
    @Test
    void staffInternalRequestReviewAllowsOnlyManagers() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "COACH", "RECEPTIONIST", "ADMIN")) {
            mvc.perform(get("/api/v1/operations/requests").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/operations/requests/5/review").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REVIEW_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(internalRequestService);

        for (String role : List.of("CENTER_MANAGER", "MANAGER")) {
            mvc.perform(get("/api/v1/operations/requests").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(put("/api/v1/operations/requests/5/review").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(INTERNAL_REVIEW_BODY))
                    .andExpect(status().isOk());
        }
        verify(internalRequestService, times(2)).getAllRequests(isNull(), isNull());
        verify(internalRequestService, times(2)).reviewRequest(eq(10L), eq(5L), any());
    }

    /** Tra cứu hội viên và lịch sử xử lý yêu cầu gói tập chỉ dành cho RECEPTIONIST và CENTER_MANAGER. */
    @Test
    void memberLookupAndRequestHistoryAllowOnlyReceptionistAndCenterManager() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "COACH", "ADMIN")) {
            mvc.perform(get("/api/v1/members/lookup").param("q", "nguyen").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/memberships/subscriptions/requests/history").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/subscriptions/requests/history").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(lookupService, requestHistoryService);

        for (String role : List.of("RECEPTIONIST", "CENTER_MANAGER")) {
            mvc.perform(get("/api/v1/members/lookup").param("q", "nguyen").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/v1/memberships/subscriptions/requests/history").param("days", "30")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/v1/subscriptions/requests/history").param("days", "30")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(lookupService, times(2)).search("nguyen");
        verify(requestHistoryService, times(4)).history(30);
    }

    /** Mở phiên realtime gói tập chỉ dành cho MEMBER và trả Cache-Control: no-store. */
    @Test
    void membershipRealtimeSessionAllowsOnlyMember() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "COACH", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/memberships/subscriptions/realtime-session")
                            .with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(realtimeService);

        mvc.perform(post("/api/v1/memberships/subscriptions/realtime-session")
                        .with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(realtimeService).open(any());
    }
}
