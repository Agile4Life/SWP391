package com.swp391.scms.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.auth.dto.GoogleOAuthResult;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private static final String CHALLENGE = "7w_YNF9DSfIdPf_pRjSq646_kPr-2-o9NAl16JGghdM";
    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private AuthService authService;

    private AuthController authController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        var redirectService = new GoogleOAuthRedirectService(authService, null, java.time.Clock.systemUTC(),
                "test-google-client.apps.googleusercontent.com", "http://localhost:8080/api/v1/auth/google/callback",
                "http://localhost:5173", false);
        authController = new AuthController(authService, false, null, redirectService);
        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/v1/auth/login returns 200 with JWT token and role")
    void loginSuccess() throws Exception {
        LoginRequest req = new LoginRequest("admin", "Admin@123");
        when(authService.login(any())).thenReturn(new AuthTokenResponse("fake-jwt-token", "admin", "CENTER_MANAGER"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("fake-jwt-token"))
                .andExpect(jsonPath("$.data.role").value("CENTER_MANAGER"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login returns 400 when username or password blank")
    void loginValidationFailure() throws Exception {
        LoginRequest req = new LoginRequest("", "");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/v1/auth/register returns 201 on valid input")
    void registerSuccess() throws Exception {
        RegisterRequest req = new RegisterRequest("newmember", "Password@123", "new@test.com", "MEMBER");
        when(authService.register(any())).thenReturn(new RegistrationResponse("Registration successful", 1L, "newmember"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("newmember"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/send-otp returns 200 with destination")
    void sendOtpSuccess() throws Exception {
        OtpRequest req = new OtpRequest("user@example.com", null);
        when(authService.generateOtp("user@example.com")).thenReturn("123456");

        mockMvc.perform(post("/api/v1/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.destination").value("user@example.com"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/verify-otp delegates to service and returns 200")
    void verifyOtpSuccess() throws Exception {
        VerifyOtpRequest req = new VerifyOtpRequest("user@example.com", "123456");

        mockMvc.perform(post("/api/v1/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVerified").value(true));

        verify(authService).verifyOtp(any());
    }

    @Test
    @DisplayName("POST /api/v1/auth/google/send-otp returns 200 with email and localized message key")
    void sendGoogleOtpSuccess() throws Exception {
        GoogleOtpRequest req = new GoogleOtpRequest("user@gmail.com");
        when(authService.requestGoogleOtp("user@gmail.com")).thenReturn("654321");

        mockMvc.perform(post("/api/v1/auth/google/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("user@gmail.com"))
                .andExpect(jsonPath("$.data.message").value("auth.google.otp.sent"))
                .andExpect(jsonPath("$.data.debugOtp").doesNotExist());
    }

    @Test
    @DisplayName("POST /api/v1/auth/google/send-otp returns 400 when email is invalid")
    void sendGoogleOtpInvalidEmail() throws Exception {
        GoogleOtpRequest req = new GoogleOtpRequest("not-an-email");

        mockMvc.perform(post("/api/v1/auth/google/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/v1/auth/google/verify-otp returns 200 with JWT token and role")
    void verifyGoogleOtpSuccess() throws Exception {
        GoogleVerifyOtpRequest req = new GoogleVerifyOtpRequest("user@gmail.com", "654321");
        when(authService.verifyGoogleOtp("user@gmail.com", "654321"))
                .thenReturn(new AuthTokenResponse("google-jwt-token", "user", "MEMBER"));

        mockMvc.perform(post("/api/v1/auth/google/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("google-jwt-token"))
                .andExpect(jsonPath("$.data.role").value("MEMBER"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/google/oauth-callback verifies Google OAuth and sends OTP to email")
    void googleOAuthCallbackSuccess() throws Exception {
        GoogleOAuthCallbackRequest req = new GoogleOAuthCallbackRequest("valid-id-token", null, null, null);
        when(authService.authenticateGoogle(any()))
                .thenReturn(new GoogleOAuthResult("oauth@gmail.com", "123456"));

        mockMvc.perform(post("/api/v1/auth/google/oauth-callback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("oauth@gmail.com"))
                .andExpect(jsonPath("$.data.message").value("auth.google.otp.sent"))
                .andExpect(jsonPath("$.data.expiresInMinutes").value(5))
                .andExpect(jsonPath("$.data.requiresOtp").value(true))
                .andExpect(jsonPath("$.data.authentication").doesNotExist())
                .andExpect(jsonPath("$.data.debugOtp").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/v1/auth/google/authorize redirects to Google OAuth 2.0 consent screen")
    void googleOAuthAuthorizeRedirectsToGoogle() throws Exception {
        mockMvc.perform(get("/api/v1/auth/google/authorize").param("code_challenge", CHALLENGE))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("http://localhost:8080/api/v1/auth/google/authorize/start")));
    }

    @Test
    @DisplayName("GET /api/v1/auth/google/callback exchanges code, sends OTP and redirects back to /login?google_oauth=callback")
    void googleOAuthRedirectCallbackRedirectsToLoginOtpScreen() throws Exception {
        when(authService.authenticateGoogle(any()))
                .thenReturn(new GoogleOAuthResult("member@gmail.com", "998877"));

        var start = mockMvc.perform(get("/api/v1/auth/google/authorize/start").param("code_challenge", CHALLENGE)).andReturn();
        var session = (org.springframework.mock.web.MockHttpSession) start.getRequest().getSession(false);
        String state = org.springframework.web.util.UriComponentsBuilder.fromUriString(start.getResponse().getHeader("Location"))
                .build().getQueryParams().getFirst("state");
        mockMvc.perform(get("/api/v1/auth/google/callback").session(session).param("state", state).param("code", "auth-code-xyz"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("http://localhost:5173/login?google_oauth=callback")))
                .andExpect(header().string("Location", containsString("email=member@gmail.com")));
    }
    @Test
    void callbackWithoutBrowserStateDoesNotExchangeCode() throws Exception {
        mockMvc.perform(get("/api/v1/auth/google/callback").param("code", "injected-code"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("google_oauth=error")));
        org.mockito.Mockito.verifyNoInteractions(authService);
    }

    @Test
    void authorizeRejectsUnconfiguredRedirect() throws Exception {
        mockMvc.perform(get("/api/v1/auth/google/authorize").param("code_challenge", CHALLENGE).param("redirect_uri", "https://attacker.example/callback"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void popupEndpointCannotBypassBrowserStateWithAuthorizationCode() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/oauth-callback").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"injected-code\"}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verifyNoInteractions(authService);
    }

    @Test
    void activeGoogleMemberReceivesAuthenticationWithoutOtpFields() throws Exception {
        when(authService.authenticateGoogle(any())).thenReturn(new GoogleOAuthResult("member@gmail.com", null,
                new AuthTokenResponse("member-jwt", "member", "MEMBER")));
        mockMvc.perform(post("/api/v1/auth/google/oauth-callback").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"valid-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requiresOtp").value(false))
                .andExpect(jsonPath("$.data.authentication.token").value("member-jwt"))
                .andExpect(jsonPath("$.data.expiresInMinutes").doesNotExist())
                .andExpect(jsonPath("$.data.debugOtp").doesNotExist());
    }

    @Test
    void invalidHandoffCannotIssueJwt() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/handoff").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("code", "c".repeat(43), "verifier", "v".repeat(43)))))
                .andExpect(status().isUnauthorized());
        org.mockito.Mockito.verifyNoInteractions(authService);
    }

}
