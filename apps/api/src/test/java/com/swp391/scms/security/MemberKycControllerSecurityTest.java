package com.swp391.scms.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.users.MemberKycController;
import com.swp391.scms.users.MemberKycReviewService;
import com.swp391.scms.users.ProfileController;
import com.swp391.scms.users.ProfileService;
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
 * Kiểm thử HTTP/Security cho luồng KYC: duyệt giấy tờ định danh (/api/v1/members/kyc/** chỉ RECEPTIONIST)
 * và nộp giấy tờ định danh (POST /api/v1/profile/kyc chỉ MEMBER — bảo vệ hồi quy P1-BE-03 / P1-BE-08).
 */
@WebMvcTest(controllers = {MemberKycController.class, ProfileController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class MemberKycControllerSecurityTest {

    private static final String SUBMIT_KYC_BODY = """
            {
              "documentType": "CCCD",
              "citizenId": "012345678901",
              "fullName": "Nguyen Van A",
              "nationality": "Việt Nam",
              "frontImageUrl": "data:image/png;base64,iVBORw0KGgo=",
              "backImageUrl": "data:image/png;base64,iVBORw0KGgo="
            }
            """;
    private static final String REJECT_BODY = "{\"reason\":\"Anh mat truoc bi mo\"}";

    @Autowired MockMvc mvc;
    @MockitoBean MemberKycReviewService kycReviewService;
    @MockitoBean ProfileService profileService;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Người chưa đăng nhập nhận 401 ở mọi endpoint nộp và duyệt KYC. */
    @Test
    void anonymousCannotAccessKycReviewOrSubmissionEndpoints() throws Exception {
        mvc.perform(get("/api/v1/members/kyc/pending")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/members/kyc/20/approve")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/members/kyc/20/reject")
                        .contentType(MediaType.APPLICATION_JSON).content(REJECT_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/profile/kyc")
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT_KYC_BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(kycReviewService, profileService);
    }

    /** Duyệt KYC là nghiệp vụ độc quyền của quầy lễ tân; mọi vai trò khác kể cả Quản lý và Admin nhận 403. */
    @Test
    void nonReceptionistRolesCannotReviewMemberKyc() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "COACH", "CENTER_MANAGER", "MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/members/kyc/pending").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/members/kyc/20/approve").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/members/kyc/20/reject").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(REJECT_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(kycReviewService);
    }

    /** Lễ tân đọc hàng chờ, phê duyệt và từ chối KYC; lý do từ chối trống hoặc quá 255 ký tự trả 400. */
    @Test
    void receptionistCanListApproveAndRejectMemberKyc() throws Exception {
        mvc.perform(get("/api/v1/members/kyc/pending").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/members/kyc/20/approve").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/members/kyc/20/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/members/kyc/20/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + "a".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/members/kyc/20/reject").with(authentication(actor("RECEPTIONIST")))
                        .contentType(MediaType.APPLICATION_JSON).content(REJECT_BODY))
                .andExpect(status().isOk());

        verify(kycReviewService).listPending();
        verify(kycReviewService).approve(any(), eq(20L));
        verify(kycReviewService).reject(any(), eq(20L), eq("Anh mat truoc bi mo"));
    }

    /** Hồi quy P1-BE-03 / P1-BE-08: POST /api/v1/profile/kyc chỉ cho MEMBER và chặn RECEPTIONIST/STAFF/COACH/MANAGER/ADMIN. */
    @Test
    void profileKycSubmissionAllowsOnlyMember() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "COACH", "CENTER_MANAGER", "MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/profile/kyc").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(SUBMIT_KYC_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(profileService);

        mvc.perform(post("/api/v1/profile/kyc").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT_KYC_BODY))
                .andExpect(status().isOk());
        verify(profileService).submitMemberKyc(eq(10L), any());
    }
}
