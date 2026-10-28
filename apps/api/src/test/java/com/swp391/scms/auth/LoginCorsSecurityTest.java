package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.config.WebConfig;
import com.swp391.scms.security.*;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Uses the real Security/MVC CORS configuration; authentication persistence is mocked. */
@WebMvcTest(AuthController.class)
@Import({WebConfig.class, SecurityConfig.class, JwtAuthenticationFilter.class,
        JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class LoginCorsSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuthService auth;
    @MockitoBean GoogleOAuthRedirectService googleRedirect;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:5180", "http://127.0.0.1:5180", "http://localhost:5173"})
    void localPreflightAndLoginReachAuthentication(String origin) throws Exception {
        mvc.perform(options("/api/v1/auth/login").header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,accept-language"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", origin));
        verifyNoInteractions(auth);
        when(auth.login(any())).thenReturn(new AuthTokenResponse("unit-token", "unit-member", "MEMBER"));
        mvc.perform(post("/api/v1/auth/login").header("Origin", origin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"unit-member\",\"password\":\"unit-test-only\"}"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", origin))
                .andExpect(jsonPath("$.data.role").value("MEMBER"));
        verify(auth).login(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://untrusted.example", "http://localhost:5181", "http://localhost:5180.evil.example"})
    void rejectsUnapprovedOriginsBeforeAuthentication(String origin) throws Exception {
        mvc.perform(options("/api/v1/auth/login").header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden()).andExpect(content().string("Invalid CORS request"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(post("/api/v1/auth/login").header("Origin", origin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden()).andExpect(content().string("Invalid CORS request"));
        verifyNoInteractions(auth);
    }
}
