package com.swp391.scms.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private AuthService authService;

    private AuthController authController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        authController = new AuthController(authService, false);
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
    @DisplayName("POST /api/v1/auth/google returns 200 with JWT token and role when token is valid")
    void loginWithGoogleSuccess() throws Exception {
        GoogleIdTokenRequest req = new GoogleIdTokenRequest("valid-google-id-token");
        when(authService.loginWithGoogle("valid-google-id-token"))
                .thenReturn(new AuthTokenResponse("jwt-token-google", "member_google", "MEMBER"));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("jwt-token-google"))
                .andExpect(jsonPath("$.data.role").value("MEMBER"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/google returns 400 when idToken is blank")
    void loginWithGoogleBlankToken() throws Exception {
        GoogleIdTokenRequest req = new GoogleIdTokenRequest("");

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }
}
