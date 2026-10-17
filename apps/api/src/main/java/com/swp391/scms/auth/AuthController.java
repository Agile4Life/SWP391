package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Tag(name = "Authentication", description = "Đăng ký tài khoản, đăng nhập JWT, gửi và xác thực mã OTP")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final boolean debugOtpEnabled;
    private final MessageService messageService;

    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled) {
        this(authService, debugOtpEnabled, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                          MessageService messageService) {
        this.authService = authService;
        this.debugOtpEnabled = debugOtpEnabled;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
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
    public ApiResponse<Map<String, Object>> sendGoogleOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            throw new BadRequestException("MISSING_EMAIL", "auth.otp.missing_target", null, "Email is required");
        }
        String code = authService.requestGoogleOtp(email.trim());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("email", email.trim());
        data.put("message", "Đã gửi mã xác nhận đến gmail " + email.trim() + ". Hãy nhập mã xác nhận để kích hoạt tài khoản.");
        data.put("expiresInMinutes", 5);
        if (debugOtpEnabled) {
            data.put("debugOtp", code);
        }
        return ApiResponse.ok(msg("auth.otp.sent"), data);
    }

    @Operation(summary = "Xác thực mã OTP Google và đăng nhập", description = "Xác thực mã OTP gửi về Gmail, kích hoạt tài khoản và trả về JWT Token")
    @PostMapping("/google/verify-otp")
    public ApiResponse<AuthTokenResponse> verifyGoogleOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otpCode = body.get("otpCode");
        if (email == null || otpCode == null || email.isBlank() || otpCode.isBlank()) {
            throw new BadRequestException("MISSING_PARAMS", "auth.otp.missing_target", null, "Email and otpCode are required");
        }
        AuthTokenResponse response = authService.verifyGoogleOtp(email.trim(), otpCode.trim());
        return ApiResponse.ok(msg("auth.login.success"), response);
    }
}