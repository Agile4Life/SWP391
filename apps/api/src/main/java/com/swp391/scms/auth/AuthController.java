package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.GoogleLoginRequest;
import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.auth.dto.GoogleOAuthOtpChallenge;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Tag(name = "Authentication", description = "Đăng ký tài khoản, đăng nhập JWT, Google OAuth và xác thực mã OTP")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final String GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

    private final AuthService authService;
    private final boolean debugOtpEnabled;
    private final MessageService messageService;
    private final String googleClientId;
    private final String googleRedirectUri;
    private final String webOrigin;

    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled) {
        this(authService, debugOtpEnabled, null, "", "http://localhost:8080/api/v1/auth/google/callback", "http://localhost:5173");
    }

    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                          MessageService messageService) {
        this(authService, debugOtpEnabled, messageService, "", "http://localhost:8080/api/v1/auth/google/callback", "http://localhost:5173");
    }

    @Autowired
    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                          MessageService messageService,
                          @Value("${app.google.client-id:${GOOGLE_CLIENT_ID:}}") String googleClientId,
                          @Value("${app.google.redirect-uri:${GOOGLE_REDIRECT_URI:http://localhost:8080/api/v1/auth/google/callback}}") String googleRedirectUri,
                          @Value("${app.cors.web-origin:http://localhost:5173}") String webOrigin) {
        this.authService = authService;
        this.debugOtpEnabled = debugOtpEnabled;
        this.messageService = messageService;
        this.googleClientId = googleClientId != null ? googleClientId.trim() : "";
        this.googleRedirectUri = googleRedirectUri != null && !googleRedirectUri.isBlank()
                ? googleRedirectUri.trim()
                : "http://localhost:8080/api/v1/auth/google/callback";
        this.webOrigin = webOrigin != null && !webOrigin.isBlank()
                ? webOrigin.trim()
                : "http://localhost:5173";
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    @Operation(summary = "Đăng nhập hệ thống", description = "Xác thực tài khoản và trả về JWT Token cùng vai trò người dùng")
    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(msg("auth.login.success"), authService.login(request));
    }

    @Operation(summary = "Đăng ký tài khoản", description = "Tạo tài khoản hội viên mới và gửi mã kích hoạt")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegistrationResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegistrationResponse registered = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(registered.message(), registered));
    }

    @Operation(summary = "Gửi mã OTP", description = "Gửi mã OTP 6 chữ số đến email hoặc số điện thoại")
    @PostMapping("/send-otp")
    public ApiResponse<Map<String, Object>> sendOtp(@Valid @RequestBody OtpRequest request) {
        String target = request.target();
        if (target == null || target.isBlank()) {
            throw new BadRequestException("MISSING_TARGET", "auth.otp.missing_target", null, null);
        }
        String code = authService.generateOtp(target);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("destination", target);
        data.put("expiresInMinutes", 5);
        if (debugOtpEnabled) {
            data.put("debugOtp", code);
        }
        return ApiResponse.ok(msg("auth.otp.sent"), data);
    }

    @Operation(summary = "Xác thực mã OTP", description = "Xác thực mã OTP và kích hoạt tài khoản hội viên")
    @PostMapping("/verify-otp")
    public ApiResponse<Map<String, Object>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        authService.verifyOtp(request);
        return ApiResponse.ok(msg("auth.otp.verified"), Map.of("target", request.target(), "isVerified", true));
    }

    @Operation(summary = "Gửi mã OTP đăng nhập Google", description = "Tạo tài khoản nếu chưa có và gửi mã OTP xác nhận về Gmail")
    @PostMapping("/google/send-otp")
    public ApiResponse<Map<String, Object>> sendGoogleOtp(@Valid @RequestBody GoogleOtpRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        if (email.isBlank()) {
            throw new BadRequestException("MISSING_EMAIL", "auth.otp.missing_target", null, null);
        }
        String code = authService.requestGoogleOtp(email);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("email", email);
        data.put("message", msg("auth.google.otp.sent", email));
        data.put("expiresInMinutes", 5);
        if (debugOtpEnabled) {
            data.put("debugOtp", code);
        }
        return ApiResponse.ok(msg("auth.otp.sent"), data);
    }

    @Operation(summary = "Xác thực Google OAuth Callback và gửi mã OTP qua Gmail",
            description = "Xác thực token/code từ Google OAuth (ID Token, Access Token hoặc Authorization Code), liên kết/tạo tài khoản MEMBER và gửi mã OTP 6 chữ số về Gmail để xác nhận")
    @PostMapping("/google/oauth-callback")
    public ApiResponse<Map<String, Object>> handleGoogleOAuthCallback(@RequestBody GoogleOAuthCallbackRequest request) {
        GoogleOAuthOtpChallenge challenge = authService.requestGoogleOAuthOtp(request);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("email", challenge.email());
        data.put("message", msg("auth.google.otp.sent", challenge.email()));
        data.put("expiresInMinutes", 5);
        if (debugOtpEnabled) {
            data.put("debugOtp", challenge.otpCode());
        }
        return ApiResponse.ok(msg("auth.otp.sent"), data);
    }

    @Operation(summary = "Khởi tạo luồng chuyển hướng Google OAuth 2.0",
            description = "Chuyển hướng trình duyệt sang trang đăng nhập tài khoản Google (OAuth 2.0 Authorization Endpoint)")
    @GetMapping("/google/authorize")
    public ResponseEntity<Void> authorizeGoogleOAuth(
            @RequestParam(value = "redirect_uri", required = false) String customRedirectUri) {
        if (googleClientId.isBlank()) {
            URI fallbackUri = UriComponentsBuilder.fromUriString(webOrigin + "/login")
                    .queryParam("google_oauth", "not_configured")
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(fallbackUri).build();
        }
        String effectiveRedirectUri = (customRedirectUri != null && !customRedirectUri.isBlank())
                ? customRedirectUri.trim()
                : googleRedirectUri;
        URI googleAuthUri = UriComponentsBuilder.fromUriString(GOOGLE_OAUTH_AUTHORIZE_URL)
                .queryParam("client_id", googleClientId)
                .queryParam("redirect_uri", effectiveRedirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "openid email profile")
                .queryParam("access_type", "online")
                .queryParam("prompt", "select_account")
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();
        return ResponseEntity.status(HttpStatus.FOUND).location(googleAuthUri).build();
    }

    @Operation(summary = "Callback nhận kết quả từ Google OAuth 2.0 Redirect",
            description = "Nhận authorization code từ Google, xác thực tài khoản, gửi mã OTP về Gmail và redirect ngược về trang Login để hiển thị màn hình nhập OTP")
    @GetMapping("/google/callback")
    public ResponseEntity<Void> googleOAuthRedirectCallback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "redirect_uri", required = false) String customRedirectUri) {
        if (error != null && !error.isBlank()) {
            URI errorUri = UriComponentsBuilder.fromUriString(webOrigin + "/login")
                    .queryParam("google_oauth", "error")
                    .queryParam("error", msg("auth.google.invalid_token"))
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(errorUri).build();
        }
        try {
            String effectiveRedirectUri = (customRedirectUri != null && !customRedirectUri.isBlank())
                    ? customRedirectUri.trim()
                    : googleRedirectUri;
            GoogleOAuthOtpChallenge challenge = authService.requestGoogleOAuthOtp(
                    new GoogleOAuthCallbackRequest(null, null, code, effectiveRedirectUri)
            );
            UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(webOrigin + "/login")
                    .queryParam("google_oauth", "callback")
                    .queryParam("email", challenge.email())
                    .queryParam("message", msg("auth.google.otp.sent", challenge.email()));
            if (debugOtpEnabled && challenge.otpCode() != null) {
                builder.queryParam("debugOtp", challenge.otpCode());
            }
            URI callbackFrontUri = builder.build().encode(StandardCharsets.UTF_8).toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(callbackFrontUri).build();
        } catch (AppException ex) {
            String resolvedError = ex.getMessageKey() != null
                    ? msg(ex.getMessageKey(), ex.getMessageArgs() != null ? ex.getMessageArgs() : new Object[0])
                    : ex.getMessage();
            URI errorUri = UriComponentsBuilder.fromUriString(webOrigin + "/login")
                    .queryParam("google_oauth", "error")
                    .queryParam("error", resolvedError)
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(errorUri).build();
        } catch (Exception ex) {
            URI errorUri = UriComponentsBuilder.fromUriString(webOrigin + "/login")
                    .queryParam("google_oauth", "error")
                    .queryParam("error", msg("auth.google.invalid_token"))
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(errorUri).build();
        }
    }

    @Operation(summary = "Xác thực mã OTP Google và đăng nhập", description = "Xác thực mã OTP gửi về Gmail, kích hoạt tài khoản và trả về JWT Token")
    @PostMapping("/google/verify-otp")
    public ApiResponse<AuthTokenResponse> verifyGoogleOtp(@Valid @RequestBody GoogleVerifyOtpRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        String otpCode = request.otpCode() == null ? "" : request.otpCode().trim();
        if (email.isBlank() || otpCode.isBlank()) {
            throw new BadRequestException("MISSING_PARAMS", "auth.otp.missing_target", null, null);
        }
        AuthTokenResponse response = authService.verifyGoogleOtp(email, otpCode);
        return ApiResponse.ok(msg("auth.login.success"), response);
    }

    @Operation(summary = "Đăng nhập Google bằng ID Token (SCRUM-89)", description = "Xác thực Google ID Token, tự động liên kết hoặc tạo tài khoản MEMBER và cấp JWT")
    @PostMapping("/google")
    public ApiResponse<AuthTokenResponse> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
        AuthTokenResponse response = authService.loginWithGoogle(request);
        return ApiResponse.ok(msg("auth.login.success"), response);
    }
}
