package com.swp391.scms.security;

import com.swp391.scms.auth.AuthController;
import com.swp391.scms.auth.AuthService;
import com.swp391.scms.auth.GoogleOAuthRedirectService;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /auth/me phải trả về vai trò hiện đang lưu trong cơ sở dữ liệu, tuyệt đối không chấp nhận người gọi ẩn danh. */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
/** Bộ kiểm thử cho AuthSessionEndpoint (auth session endpoint). */
class AuthSessionEndpointTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuthService authService;
    @MockitoBean GoogleOAuthRedirectService googleRedirect;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    /** Kiểm thử: người gọi chưa đăng nhập bị từ chối. */
    @Test
    void anonymousCallerIsRejected() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    /** Kiểm thử: người đã đăng nhập nhận lại username và vai trò hiện tại. */
    @Test
    void authenticatedCallerReceivesCurrentUsernameAndRole() throws Exception {
        var auth = new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(7L, "manager01", "CENTER_MANAGER"),
                null, List.of(new SimpleGrantedAuthority("ROLE_CENTER_MANAGER")));
        mvc.perform(get("/api/v1/auth/me").with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("manager01"))
                .andExpect(jsonPath("$.data.role").value("CENTER_MANAGER"));
    }

    /** Kiểm thử: tài khoản chỉ có email thì tên đầy đủ được tra theo id. */
    @Test
    void emailOnlyAccountGetsItsFullNameLookedUpById() throws Exception {
        // Tài khoản demo và nhân viên không có username: principal chứa email, nên phải tra họ tên theo id.
        org.mockito.Mockito.when(authService.fullNameOf(7L)).thenReturn("Nguyễn Minh An");
        var auth = new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(7L, "an@demo.sol.vn", "MEMBER"),
                null, List.of(new SimpleGrantedAuthority("ROLE_MEMBER")));
        mvc.perform(get("/api/v1/auth/me").with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Nguyễn Minh An"));
    }
}
