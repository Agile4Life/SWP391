package com.swp391.scms.security;

import com.swp391.scms.ai.AiChatController;
import com.swp391.scms.ai.service.AiChatService;
import com.swp391.scms.attendance.CenterCheckinController;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.ReceptionTrialController;
import com.swp391.scms.membership.service.MemberTrialService;
import com.swp391.scms.users.MemberKycController;
import com.swp391.scms.users.MemberKycReviewService;
import com.swp391.scms.users.ProfileController;
import com.swp391.scms.users.ProfileService;
import com.swp391.scms.users.UserRepository;
import java.time.LocalDateTime;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Kiểm thử hồi quy P1-BE-03, P1-BE-08, P2-BE-08, P2-BE-10 cho SecurityConfig và phân quyền KYC/Trial/Check-in/AI Chat. */
@WebMvcTest(controllers = {
        ReceptionTrialController.class,
        CenterCheckinController.class,
        AiChatController.class,
        ProfileController.class,
        MemberKycController.class
})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class SecurityConfigRegressionTest {

    @Autowired MockMvc mvc;
    @MockitoBean MemberTrialService trialService;
    @MockitoBean CenterCheckinService checkinService;
    @MockitoBean AiChatService aiChatService;
    @MockitoBean ProfileService profileService;
    @MockitoBean MemberKycReviewService kycReviewService;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Kiểm thử P1-BE-03: /api/v1/memberships/trial/requests/** cho phép RECEPTIONIST/CENTER_MANAGER/ADMIN và chặn MEMBER. */
    @Test
    void trialRequestsMatcherIsEvaluatedBeforeMemberTrialMatcher() throws Exception {
        for (String role : List.of("RECEPTIONIST", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/memberships/trial/requests").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/memberships/trial/requests/5/approve").with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/memberships/trial/requests").with(authentication(actor("MEMBER"))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/memberships/trial/requests/5/approve").with(authentication(actor("MEMBER"))))
                .andExpect(status().isForbidden());
    }

    /** Kiểm thử P1-BE-03: ADMIN được phép truy cập /check-in/scan, /{id}/checkout và /history đồng bộ với CenterCheckinController. */
    @Test
    void adminCanAccessCheckinScanCheckoutAndHistory() throws Exception {
        when(checkinService.scan(any(), any())).thenReturn(new CheckinDto(1L, 10L, "Member",
                LocalDateTime.of(2026, 11, 25, 9, 0), null, "qr", null, "GRANTED"));
        mvc.perform(post("/api/v1/check-in/scan").with(authentication(actor("ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"qrCode\":\"sample\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/check-in/1/checkout").with(authentication(actor("ADMIN"))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/check-in/history").with(authentication(actor("ADMIN"))))
                .andExpect(status().isOk());
    }

    /** Kiểm thử P1-BE-03: COACH không còn được phép truy cập /api/v1/ai/chat/** (đồng bộ AiChatController). */
    @Test
    void coachIsForbiddenFromAiChatWhileMemberReceptionistManagerAllowed() throws Exception {
        mvc.perform(get("/api/v1/ai/chat/sessions").with(authentication(actor("COACH"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(aiChatService);

        for (String role : List.of("MEMBER", "RECEPTIONIST", "CENTER_MANAGER")) {
            mvc.perform(get("/api/v1/ai/chat/sessions").with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
    }

    /** Kiểm thử P1-BE-08: POST /api/v1/profile/kyc chỉ dành cho MEMBER; nhân sự bị từ chối 403. */
    @Test
    void profileKycSubmissionAllowsOnlyMember() throws Exception {
        String body = """
                {
                  "documentType": "CCCD",
                  "citizenId": "012345678901",
                  "fullName": "Nguyen Van A",
                  "nationality": "Việt Nam",
                  "frontImageUrl": "data:image/png;base64,iVBORw0KGgo=",
                  "backImageUrl": "data:image/png;base64,iVBORw0KGgo="
                }
                """;
        for (String role : List.of("RECEPTIONIST", "COACH", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/profile/kyc").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(profileService);

        mvc.perform(post("/api/v1/profile/kyc").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        verify(profileService).submitMemberKyc(any(), any());
    }

    /** Kiểm thử P2-BE-10 & P1-E2E-02: /api/v1/members/kyc/** chỉ cho RECEPTIONIST và validate RejectRequest. */
    @Test
    void memberKycReviewEnforcesReceptionistRoleAndRejectValidation() throws Exception {
        for (String role : List.of("MEMBER", "COACH", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/members/kyc/pending").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/members/kyc/10/approve").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(kycReviewService);

        mvc.perform(get("/api/v1/members/kyc/pending").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/members/kyc/10/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/members/kyc/10/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + "x".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/members/kyc/10/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Ảnh mờ\"}"))
                .andExpect(status().isOk());
        verify(kycReviewService).reject(any(), org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.eq("Ảnh mờ"));
    }
}
