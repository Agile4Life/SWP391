package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.AuthSessionResponse;
import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.GoogleLoginRequest;
import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.auth.dto.GoogleOAuthResult;
import com.swp391.scms.auth.dto.GoogleOAuthResponse;
import com.swp391.scms.auth.dto.GoogleHandoffRequest;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * API xác thực (/api/v1/auth): đăng nhập, đăng ký, gửi/xác thực OTP, quên mật khẩu và đăng nhập Google (popup
 * và chuyển hướng). Controller chỉ nhận request, gọi AuthService và đóng gói ApiResponse.
 */
@Tag(name = "Authentication", description = "Đăng ký tài khoản, đăng nhập JWT, Google OAuth và xác thực mã OTP")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final boolean debugOtpEnabled;
    private final MessageService messageService;
    private final GoogleOAuthRedirectService googleOAuthRedirectService;

    /** Constructor cho test: không có MessageService và luồng Google chuyển hướng. */
    public AuthController(AuthService authService, boolean debugOtpEnabled) {
        this(authService, debugOtpEnabled, null, null);
    }

    /** Constructor cho test: có MessageService, không có luồng Google chuyển hướng. */
    public AuthController(AuthService authService, boolean debugOtpEnabled, MessageService messageService) {
        this(authService, debugOtpEnabled, messageService, null);
    }

    /**
     * Constructor Spring dùng. debugOtpEnabled (app.auth.debug-otp-enabled) chỉ bật ở môi trường dev để trả kèm
     * mã OTP trong phản hồi, giúp test mà không cần email.
     */
    @Autowired
    public AuthController(AuthService authService,
                          @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                          MessageService messageService, GoogleOAuthRedirectService googleOAuthRedirectService) {
        this.authService = authService;
        this.debugOtpEnabled = debugOtpEnabled;
        this.messageService = messageService;
        this.googleOAuthRedirectService = googleOAuthRedirectService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** POST /login: đăng nhập bằng tên đăng nhập/email/SĐT và mật khẩu, trả JWT cùng vai trò. */
    @Operation(summary = "Đăng nhập hệ thống", description = "Xác thực tài khoản và trả về JWT Token cùng vai trò người dùng")
    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(msg("auth.login.success"), authService.login(request));
    }

    @Operation(summary = "Xác minh phiên hiện tại",
            description = "Trả về tên đăng nhập và vai trò hiện hành trong cơ sở dữ liệu để frontend đồng bộ phiên sau khi Admin đổi vai trò")
    /**
     * GET /me: trả tên đăng nhập, vai trò hiện tại trong database và họ tên, để frontend đồng bộ phiên (ví dụ
     * sau khi Admin đổi vai trò).
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<AuthSessionResponse> me(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("auth.me.success"), new AuthSessionResponse(principal.username(), principal.role(), authService.fullNameOf(principal.id())));
    }

    /** POST /register: tạo tài khoản hội viên ở trạng thái chờ kích hoạt (inactive), trả HTTP 201. */
    @Operation(summary = "Đăng ký tài khoản", description = "Tạo tài khoản hội viên mới và gửi mã kích hoạt")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegistrationResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegistrationResponse registered = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(registered.message(), registered));
    }

    /** POST /send-otp: gửi mã OTP 6 số tới email của tài khoản đang chờ kích hoạt. Mã có hiệu lực 5 phút. */
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

    /** POST /verify-otp: kiểm tra mã OTP và kích hoạt tài khoản. */
    @Operation(summary = "Xác thực mã OTP", description = "Xác thực mã OTP và kích hoạt tài khoản hội viên")
    @PostMapping("/verify-otp")
    public ApiResponse<Map<String, Object>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        authService.verifyOtp(request);
        return ApiResponse.ok(msg("auth.otp.verified"), Map.of("target", request.target(), "isVerified", true));
    }

    /** POST /password/send-otp: gửi mã OTP đặt lại mật khẩu về email. */
    @Operation(summary = "Gửi mã OTP đặt lại mật khẩu", description = "Gửi mã OTP 6 chữ số qua email để đặt lại mật khẩu")
    @PostMapping("/password/send-otp")
    public ApiResponse<Map<String, Object>> sendPasswordResetOtp(@Valid @RequestBody GoogleOtpRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        if (email.isBlank()) {
            throw new BadRequestException("MISSING_EMAIL", "auth.otp.missing_target", null, null);
        }
        String code = authService.requestPasswordResetOtp(email);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("email", email);
        data.put("expiresInMinutes", 5);
        if (debugOtpEnabled) {
            data.put("debugOtp", code);
        }
        return ApiResponse.ok(msg("auth.password.otp_sent"), data);
    }

    /** POST /password/reset: kiểm tra mã OTP rồi đặt mật khẩu mới. */
    @Operation(summary = "Đặt lại mật khẩu bằng OTP", description = "Xác thực mã OTP 6 chữ số và cập nhật mật khẩu mới")
    @PostMapping("/password/reset")
    public ApiResponse<Map<String, Object>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPasswordWithOtp(request);
        return ApiResponse.ok(msg("auth.password.reset_success"), Map.of("email", request.email().trim()));
    }

    /** POST /google/send-otp: gửi lại mã OTP xác nhận cho tài khoản đang chờ kích hoạt đã xác minh Google OAuth. */
    @Operation(summary = "Gửi lại mã OTP đăng nhập Google", description = "Gửi lại mã OTP kích hoạt cho tài khoản đã xác minh Google OAuth và đang chờ kích hoạt")
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

    @Operation(summary = "Authenticate Google members or request activation OTP (SCRUM-89)",
            description = "Active members receive authentication immediately; pending members receive activation OTP. Authorization codes use the state-protected redirect callback.")
    /**
     * POST /google/oauth-callback (luồng popup): hội viên đã kích hoạt được đăng nhập ngay; tài khoản chờ kích
     * hoạt nhận OTP qua email.
     */
    @PostMapping("/google/oauth-callback")
    public ApiResponse<GoogleOAuthResponse> handleGoogleOAuthCallback(@Valid @RequestBody GoogleOAuthCallbackRequest request) {
        GoogleOAuthResult result = authService.authenticateGoogle(request);
        boolean requiresOtp = result.authentication() == null;
        String message = requiresOtp ? msg("auth.google.otp.sent", result.email()) : msg("auth.login.success");
        return ApiResponse.ok(message, new GoogleOAuthResponse(requiresOtp, result.email(), result.authentication(),
                message, requiresOtp ? 5 : null, requiresOtp && debugOtpEnabled ? result.otpCode() : null));
    }

    /**
     * POST /google/handoff: đổi mã trao tay một lần (sau luồng chuyển hướng Google) lấy JWT; phải gửi kèm
     * verifier PKCE khớp với challenge lúc bắt đầu. Không cho trình duyệt lưu cache phản hồi.
     */
    @PostMapping("/google/handoff")
    public ResponseEntity<ApiResponse<AuthTokenResponse>> redeemGoogleHandoff(@Valid @RequestBody GoogleHandoffRequest request) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(ApiResponse.ok(msg("auth.login.success"), googleOAuthRedirectService.redeem(request.code(), request.verifier())));
    }

    /**
     * GET /google/authorize: điểm bắt đầu luồng chuyển hướng Google; chuyển tiếp sang /google/authorize/start
     * trên đúng host của callback để cookie phiên hoạt động.
     */
    @GetMapping("/google/authorize")
    public ResponseEntity<Void> authorizeGoogleOAuth(
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam("code_challenge") String challenge) {
        return redirect(googleOAuthRedirectService.entry(redirectUri, challenge));
    }

    /**
     * GET /google/authorize/start: tạo state chống giả mạo trong session rồi chuyển hướng sang trang đăng nhập
     * của Google.
     */
    @GetMapping("/google/authorize/start")
    public ResponseEntity<Void> startGoogleOAuth(HttpServletRequest request, @RequestParam("code_challenge") String challenge) {
        return redirect(googleOAuthRedirectService.authorize(request.getSession(true), challenge));
    }

    /**
     * GET /google/callback: Google gọi lại sau khi người dùng đăng nhập; kiểm tra state, đổi code lấy thông tin
     * người dùng rồi chuyển hướng về trang /login của frontend kèm kết quả.
     */
    @GetMapping("/google/callback")
    public ResponseEntity<Void> googleOAuthRedirectCallback(HttpServletRequest request,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri) {
        return redirect(googleOAuthRedirectService.complete(request.getSession(false), state, code, error, redirectUri));
    }

    /** Tạo phản hồi HTTP 302 chuyển hướng tới địa chỉ cho trước, không cho cache. */
    private ResponseEntity<Void> redirect(URI location) {
        return ResponseEntity.status(HttpStatus.FOUND).cacheControl(org.springframework.http.CacheControl.noStore()).location(location).build();
    }

    /** POST /google/verify-otp: kiểm tra OTP gửi về Gmail, kích hoạt tài khoản (nếu đang chờ) và trả JWT. */
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

    /**
     * POST /google: đăng nhập bằng Google ID Token; tự liên kết với tài khoản có sẵn hoặc tạo tài khoản MEMBER
     * mới rồi cấp JWT.
     */
    @Operation(summary = "Đăng nhập Google bằng ID Token (SCRUM-89)", description = "Xác thực Google ID Token, tự động liên kết hoặc tạo tài khoản MEMBER và cấp JWT")
    @PostMapping("/google")
    public ApiResponse<AuthTokenResponse> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
        AuthTokenResponse response = authService.loginWithGoogle(request);
        return ApiResponse.ok(msg("auth.login.success"), response);
    }
}
