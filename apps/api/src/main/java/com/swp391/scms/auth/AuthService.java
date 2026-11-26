package com.swp391.scms.auth;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.exception.TooManyRequestsException;
import com.swp391.scms.common.exception.UnauthorizedException;
import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.GoogleLoginRequest;
import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.auth.dto.GoogleOAuthResult;
import com.swp391.scms.auth.dto.GoogleUserInfo;
import com.swp391.scms.auth.dto.RegistrationResponse;
import com.swp391.scms.security.JwtService;
import com.swp391.scms.users.RoleRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.common.i18n.MessageService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Nghiệp vụ xác thực: đăng nhập (có khóa tạm khi sai nhiều lần), đăng ký hội viên, OTP kích hoạt/quên mật khẩu,
 * đăng nhập Google và cấp JWT.
 */
@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{3,50}$");
    // Chuỗi băm BCrypt hợp lệ cố định dùng khi không tìm thấy tài khoản để cân bằng thời gian phản hồi (chống dò tài khoản qua timing).
    static final String DUMMY_BCRYPT_HASH =
            "$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6Z0o.N6r7J9Y1aZ0k8W6tM3W5Z5yG";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final OtpDeliveryPort otpDeliveryPort;
    private final boolean debugOtpEnabled;
    private final Clock clock;
    private final MessageService messageService;
    private final GoogleTokenVerifierPort googleTokenVerifierPort;
    private final com.swp391.scms.notifications.NotificationService notificationService;
    private final LoginAttemptService loginAttemptService;
    private final TransactionTemplate writeTx;

    /** Constructor cho test với tập phụ thuộc tối thiểu. */
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, null, null, null, null, null);
    }

    /** Constructor cho test có MessageService. */
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, messageService, null, null, null, null);
    }

    /** Constructor cho test có thêm bộ xác minh Google. */
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService,
                       GoogleTokenVerifierPort googleTokenVerifierPort) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, messageService, googleTokenVerifierPort, null, null, null);
    }

    /** Constructor cho test có thêm NotificationService. */
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService,
                       GoogleTokenVerifierPort googleTokenVerifierPort,
                       com.swp391.scms.notifications.NotificationService notificationService) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, messageService, googleTokenVerifierPort, notificationService, null, null);
    }

    /** Constructor cho test có đầy đủ phụ thuộc trừ PlatformTransactionManager. */
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService,
                       GoogleTokenVerifierPort googleTokenVerifierPort,
                       com.swp391.scms.notifications.NotificationService notificationService,
                       LoginAttemptService loginAttemptService) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, messageService, googleTokenVerifierPort, notificationService, loginAttemptService, null);
    }

    /**
     * Constructor Spring dùng: các phụ thuộc tùy chọn (Google, thông báo, chống dò mật khẩu, transaction manager)
     * có thể vắng mặt; thiếu LoginAttemptService thì tự tạo bản mặc định.
     */
    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService,
                       @org.springframework.beans.factory.annotation.Autowired(required = false) GoogleTokenVerifierPort googleTokenVerifierPort,
                       @org.springframework.beans.factory.annotation.Autowired(required = false) com.swp391.scms.notifications.NotificationService notificationService,
                       @org.springframework.beans.factory.annotation.Autowired(required = false) LoginAttemptService loginAttemptService,
                       @org.springframework.beans.factory.annotation.Autowired(required = false) PlatformTransactionManager transactionManager) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.otpDeliveryPort = otpDeliveryPort;
        this.debugOtpEnabled = debugOtpEnabled;
        this.clock = clock;
        this.messageService = messageService;
        this.googleTokenVerifierPort = googleTokenVerifierPort;
        this.notificationService = notificationService;
        this.loginAttemptService = loginAttemptService != null ? loginAttemptService : new LoginAttemptService(clock);
        this.writeTx = transactionManager != null ? new TransactionTemplate(transactionManager) : null;
    }

    /** Chạy hành động ghi trong một transaction độc lập (không có PlatformTransactionManager trong unit test thì chạy trực tiếp). */
    private <T> T inWriteTx(Supplier<T> action) {
        return writeTx != null ? writeTx.execute(status -> action.get()) : action.get();
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** Lấy giá trị trường loginAttemptService. */
    public LoginAttemptService getLoginAttemptService() {
        return loginAttemptService;
    }

    /**
     * Đăng nhập: nếu định danh đang bị khóa tạm thì báo 429 kèm số giây còn lại. Sai mật khẩu thì tăng bộ đếm
     * và báo còn bao nhiêu lần thử (hết lượt thì khóa). Tài khoản không active thì báo 403. Thành công thì xóa
     * bộ đếm, cập nhật lần đăng nhập cuối và cấp JWT. Thông báo sai không phân biệt "sai tên" hay "sai mật
     * khẩu" để không lộ tài khoản nào tồn tại.
     */
    @Transactional
    public AuthTokenResponse login(LoginRequest request) {
        String identifier = normalize(request.username());

        if (loginAttemptService.isBlocked(identifier)) {
            long remainingSeconds = Math.max(1, loginAttemptService.getRemainingLockoutSeconds(identifier));
            throw new TooManyRequestsException("LOGIN_LOCKED", "auth.login.locked",
                    new Object[]{remainingSeconds},
                    "Tài khoản tạm thời bị khóa do nhập sai quá 5 lần. Vui lòng thử lại sau " + remainingSeconds + " giây.");
        }

        User user = (identifier.contains("@")
                ? userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(identifier)
                : userRepository.findByUsernameIgnoreCaseAndDeletedAtIsNull(identifier))
                .orElse(null);
        boolean passwordMatches;
        if (user != null) {
            passwordMatches = passwordEncoder.matches(request.password(), user.getPasswordHash());
        } else {
            passwordEncoder.matches(request.password(), DUMMY_BCRYPT_HASH);
            passwordMatches = false;
        }

        if (!passwordMatches) {
            int remaining = loginAttemptService.recordFailure(identifier);
            if (remaining <= 0) {
                long remainingSeconds = Math.max(1, loginAttemptService.getRemainingLockoutSeconds(identifier));
                throw new TooManyRequestsException("LOGIN_LOCKED", "auth.login.locked",
                        new Object[]{remainingSeconds},
                        "Tài khoản tạm thời bị khóa do nhập sai quá 5 lần. Vui lòng thử lại sau " + remainingSeconds + " giây.");
            }
            throw new UnauthorizedException("INVALID_CREDENTIALS", "auth.login.invalid_credentials_remaining",
                    new Object[]{remaining},
                    "Tên đăng nhập hoặc mật khẩu không chính xác. Bạn còn " + remaining + " lần thử.");
        }

        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }

        loginAttemptService.loginSucceeded(identifier);
        user.setLastLoginAt(LocalDateTime.now(clock));
        return issueTokenForUser(user);
    }

    /**
     * Đăng ký hội viên: kiểm tra email hợp lệ, tên đăng nhập/email/SĐT chưa ai dùng (SĐT được chuẩn hóa trước
     * khi so), rồi tạo tài khoản MEMBER ở trạng thái chờ kích hoạt.
     */
    @Transactional
    public RegistrationResponse register(RegisterRequest request) {
        if (request.username() == null || !isValidUsername(request.username())) {
            throw new BadRequestException("INVALID_USERNAME", "validation.auth.username.size", null, null);
        }
        if (!isValidEmail(request.email())) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        String username = normalize(request.username());
        String email = normalize(request.email());
        if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new ConflictException("USERNAME_EXISTS", "auth.register.username_exists", null, null);
        }
        if (com.swp391.scms.users.UserService.emailExists(userRepository, email)) {
            throw new ConflictException("EMAIL_EXISTS", "auth.register.email_exists", null, null);
        }
        String phone = null;
        if (request.phone() != null && !request.phone().isBlank()) {
            phone = request.phone().replaceAll("\\s+", "");
            if (!isValidPhone(phone)) {
                throw new BadRequestException("INVALID_PHONE", "validation.users.phone.invalid", null, null);
            }
            phone = com.swp391.scms.users.UserService.normalizePhone(phone);
            if (com.swp391.scms.users.UserService.phoneExists(userRepository, request.phone(), null)) {
                throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null);
            }
        }

        User user = createPendingMemberUser(username, request.fullName(), email, phone, request.password());
        return new RegistrationResponse(
                msg("auth.register.success"),
                user.getId(), username);
    }

    /**
     * Kiểm tra OTP (mục đích kích hoạt tài khoản) rồi kích hoạt tài khoản đang chờ trong một transaction độc lập
     * để không giữ kết nối ngoài khi gọi {@code otpService.verifyOtp} ({@code REQUIRES_NEW}).
     */
    public OtpService.Status verifyOtp(VerifyOtpRequest request) {
        OtpService.Status status = verifyOtpChallenge(request.target(), request.otpCode(), OtpPurpose.ACCOUNT_ACTIVATION);
        inWriteTx(() -> {
            activateAccount(request.target());
            return null;
        });
        return status;
    }

    /** Tìm tài khoản chưa xóa theo email (nếu chuỗi có @) hoặc theo SĐT; không thấy thì báo 404. */
    @Transactional(readOnly = true)
    public User findOtpTarget(String target) {
        String normalizedTarget = normalize(target);
        return (normalizedTarget.contains("@")
                ? userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(normalizedTarget)
                : userRepository.findByPhoneAndDeletedAtIsNull(normalizedTarget))
                .orElseThrow(() -> new ResourceNotFoundException("resource.account", target));
    }

    /** Gửi OTP kích hoạt: chỉ cho tài khoản đang chờ kích hoạt. */
    public String generateOtp(String target) {
        findPendingUser(target);
        return issueAndSendOtp(normalize(target), OtpPurpose.ACCOUNT_ACTIVATION);
    }

    /** Gửi OTP đặt lại mật khẩu: email phải hợp lệ, tài khoản phải tồn tại và không bị khóa. */
    public String requestPasswordResetOtp(String rawEmail) {
        if (!isValidEmail(rawEmail)) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        String email = normalize(rawEmail);
        User user = userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(email)
                .orElseThrow(() -> new ResourceNotFoundException("resource.account", email));
        if ("locked".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }
        return issueAndSendOtp(email, OtpPurpose.PASSWORD_RESET);
    }

    /**
     * Đặt lại mật khẩu bằng OTP: kiểm tra OTP (đúng mục đích PASSWORD_RESET, ngoài transaction ghi để tránh giữ
     * hai kết nối pool cùng lúc), mã hóa mật khẩu mới bằng BCrypt, tài khoản đang chờ kích hoạt được kích hoạt
     * luôn (vì đã chứng minh sở hữu email), rồi gửi thông báo "mật khẩu đã đổi".
     */
    public void resetPasswordWithOtp(ResetPasswordRequest request) {
        if (request == null || !isValidEmail(request.email())) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        if (request.otpCode() == null || request.otpCode().isBlank()) {
            throw new BadRequestException("INVALID_OTP", "validation.auth.otp.not_blank", null, null);
        }
        String email = normalize(request.email());
        verifyOtpChallenge(email, request.otpCode().trim(), OtpPurpose.PASSWORD_RESET);

        inWriteTx(() -> {
            User user = userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(email)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.account", email));
            if ("locked".equalsIgnoreCase(user.getStatus())) {
                throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
            }

            user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
            if ("inactive".equalsIgnoreCase(user.getStatus())) {
                user.setStatus("active");
            }
            user.setUpdatedAt(LocalDateTime.now(clock));
            userRepository.save(user);

            if (notificationService != null && user.getId() != null) {
                notificationService.send(
                        user.getId(),
                        msg("notifications.auth.password_changed.title"),
                        msg("notifications.auth.password_changed.body"),
                        "password_changed",
                        "user",
                        user.getId()
                );
            }
            return null;
        });
    }

    /** Chuyển tài khoản đang chờ sang active. */
    private void activateAccount(String target) {
        User user = findPendingUser(target);
        user.setStatus("active");
        user.setUpdatedAt(LocalDateTime.now(clock));
        userRepository.save(user);
    }

    /** Lấy tài khoản theo email/SĐT và bắt buộc phải đang ở trạng thái chờ kích hoạt (inactive). */
    private User findPendingUser(String target) {
        User user = findOtpTarget(target);
        if (!"inactive".equalsIgnoreCase(user.getStatus())) {
            throw new BadRequestException("ACCOUNT_NOT_PENDING", "auth.account.not_pending", null, null);
        }
        return user;
    }

    /**
     * Gửi lại OTP kích hoạt đăng nhập Google: KHÔNG BAO GIỜ tạo mới tài khoản. Chỉ cho phép gửi lại OTP mục đích
     * GOOGLE_ACTIVATION cho tài khoản đã hoàn tất xác minh Google OAuth (đã gắn google_sub) và đang ở trạng thái
     * chờ kích hoạt.
     */
    @Transactional
    public String requestGoogleOtp(String rawEmail) {
        if (!isValidEmail(rawEmail)) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        String email = normalize(rawEmail);

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UnauthorizedException("GOOGLE_AUTH_REQUIRED", "auth.google.state_invalid", null,
                        "Google OAuth verification is required before requesting OTP"));
        ensureGoogleOtpAccountAllowed(user);
        requireGoogleLinkedAccount(user);
        if (!"inactive".equalsIgnoreCase(user.getStatus())) {
            throw new BadRequestException("ACCOUNT_NOT_PENDING", "auth.account.not_pending", null, null);
        }

        return issueAndSendOtp(email, OtpPurpose.GOOGLE_ACTIVATION);
    }

    /**
     * Xử lý thông tin Google trả về (ID Token, Access Token hoặc Authorization Code): xác minh với Google,
     * email phải đã xác minh, tìm hoặc tạo tài khoản. Tài khoản active thì cấp JWT ngay; tài khoản chờ kích
     * hoạt thì gửi OTP.
     *
     * Xử lý callback Google OAuth (qua ID Token, OAuth2 Access Token hoặc Authorization Code): xác minh danh
     * tính và hạn chế tài khoản, đăng nhập hội viên đang hoạt động, hoặc gửi OTP kích hoạt cho hội viên đang
     * chờ.
     */
    @Transactional
    public GoogleOAuthResult authenticateGoogle(GoogleOAuthCallbackRequest request) {
        if (request == null) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google OAuth payload is missing");
        }
        if (googleTokenVerifierPort == null) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google Token Verifier is not available");
        }

        GoogleUserInfo googleUser;
        if (request.idToken() != null && !request.idToken().isBlank()) {
            googleUser = googleTokenVerifierPort.verify(request.idToken());
        } else if (request.accessToken() != null && !request.accessToken().isBlank()) {
            googleUser = googleTokenVerifierPort.verifyAccessToken(request.accessToken());
        } else if (request.code() != null && !request.code().isBlank()) {
            googleUser = googleTokenVerifierPort.verifyAuthorizationCode(request.code(), request.redirectUri());
        } else {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google OAuth token or authorization code is missing");
        }

        if (googleUser == null || !googleUser.emailVerified()) {
            throw new UnauthorizedException("GOOGLE_EMAIL_NOT_VERIFIED", "auth.google.email_not_verified", null, "Google email is not verified");
        }

        User user = resolveOrCreateGoogleUser(googleUser, "inactive", true);
        ensureGoogleOtpAccountAllowed(user);

        if ("active".equalsIgnoreCase(user.getStatus())) {
            LocalDateTime now = LocalDateTime.now(clock);
            user.setLastLoginAt(now);
            user.setUpdatedAt(now);
            userRepository.save(user);
            return new GoogleOAuthResult(normalize(user.getEmail()), null, issueTokenForUser(user));
        }

        String accountEmail = normalize(user.getEmail());
        String otpCode = issueAndSendOtp(accountEmail, OtpPurpose.GOOGLE_ACTIVATION);
        return new GoogleOAuthResult(accountEmail, otpCode);
    }

    /**
     * Kiểm tra OTP đăng nhập Google (mục đích GOOGLE_ACTIVATION, ngoài transaction ghi để tránh lồng kết nối
     * pool), yêu cầu tài khoản đã liên kết Google và đang chờ kích hoạt, kích hoạt tài khoản, cập nhật lần đăng
     * nhập cuối và cấp JWT.
     */
    public AuthTokenResponse verifyGoogleOtp(String rawEmail, String otpCode) {
        if (!isValidEmail(rawEmail)) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        if (otpCode == null || otpCode.isBlank()) {
            throw new BadRequestException("INVALID_OTP", "validation.auth.otp.not_blank", null, null);
        }
        String email = normalize(rawEmail);
        verifyOtpChallenge(email, otpCode.trim(), OtpPurpose.GOOGLE_ACTIVATION);

        return inWriteTx(() -> {
            User user = userRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.account", email));
            ensureGoogleOtpAccountAllowed(user);
            requireGoogleLinkedAccount(user);
            if (!"inactive".equalsIgnoreCase(user.getStatus())) {
                throw new BadRequestException("ACCOUNT_NOT_PENDING", "auth.account.not_pending", null, null);
            }

            LocalDateTime now = LocalDateTime.now(clock);
            user.setStatus("active");
            user.setLastLoginAt(now);
            user.setUpdatedAt(now);
            userRepository.save(user);

            return issueTokenForUser(user);
        });
    }

    /**
     * Tạo tên đăng nhập duy nhất từ phần trước @ của email (bỏ ký tự đặc biệt, tối thiểu 3, tối đa 40 ký tự);
     * trùng thì thêm số 1, 2, 3...
     */
    private String generateUniqueUsernameFromEmail(String email) {
        return generateUniqueUsernameFromEmail(email, null);
    }

    /**
     * Tạo tên đăng nhập duy nhất từ phần trước @ của email, tránh trùng cả DB lẫn tên đăng nhập cũ cần thay thế
     * (khi thu hồi tài khoản đăng ký chưa xác thực).
     */
    private String generateUniqueUsernameFromEmail(String email, String excludedUsername) {
        String baseUsername = email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "");
        if (baseUsername.length() < 3) {
            baseUsername = "user_" + baseUsername;
        }
        if (baseUsername.length() > 40) {
            baseUsername = baseUsername.substring(0, 40);
        }
        String username = baseUsername;
        int suffix = 1;
        while ((excludedUsername != null && username.equalsIgnoreCase(excludedUsername))
                || userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            username = baseUsername + suffix++;
        }
        return username;
    }

    /** Tạo tài khoản hội viên chờ kích hoạt khi không có họ tên. */
    private User createPendingMemberUser(String username, String email, String phone, String rawPassword) {
        return createPendingMemberUser(username, null, email, phone, rawPassword);
    }

    /**
     * Tạo tài khoản hội viên chờ kích hoạt. {@code fullName} là tên hiển thị ở quầy, màn hình HLV và màn check-in;
     * chỉ dùng tên đăng nhập làm giá trị dự phòng khi không có họ tên.
     */
    private User createPendingMemberUser(String username, String fullName, String email, String phone, String rawPassword) {
        String name = fullName == null ? null : fullName.trim().replaceAll("\\s+", " ");
        return createMemberAccount(username, name == null || name.isBlank() ? username : name, email, phone, rawPassword, null, null, "inactive");
    }

    /**
     * Họ tên hiển thị của người dùng cho phiên hiện tại (tìm theo id vì tài khoản nhân viên có thể không có tên
     * đăng nhập).
     *
     * Tên hiển thị cho phiên hiện tại (không bao giờ là định danh đăng nhập khi tài khoản có tên thật).
     */
    @Transactional(readOnly = true)
    public String fullNameOf(Long userId) {
        // Theo id: tài khoản chỉ có email (nhân viên, demo, admin bootstrap) không có username để tra.
        if (userId == null) return null;
        return userRepository.findByIdAndDeletedAtIsNull(userId).map(User::getFullName).orElse(null);
    }

    /**
     * Tạo bản ghi User với vai trò MEMBER (mật khẩu mã hóa BCrypt, ảnh đại diện mặc định nếu không có), lưu để
     * có id, rồi tạo hồ sơ Member đi kèm với mã hội viên "MEM-<id>", ngày tham gia hôm nay và trình độ
     * beginner.
     */
    private User createMemberAccount(
            String username,
            String fullName,
            String email,
            String phone,
            String rawPassword,
            String googleSub,
            String avatarUrl,
            String initialStatus) {
        Role memberRole = roleRepository.findByCodeIgnoreCase("MEMBER")
                .orElseThrow(() -> new ResourceNotFoundException("resource.role_member", "MEMBER"));

        User user = new User();
        user.setUsername(username);
        user.setRole(memberRole);
        user.setFullName(fullName != null && !fullName.isBlank() ? fullName : username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setGoogleSub(googleSub);
        user.setAvatarUrl(avatarUrl != null && !avatarUrl.isBlank() ? avatarUrl : User.DEFAULT_AVATAR_URL);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setStatus(initialStatus);
        LocalDateTime now = LocalDateTime.now(clock);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.saveAndFlush(user);

        Member member = new Member();
        member.setUser(user);
        member.setMembershipCode("MEM-" + user.getId());
        member.setJoinDate(LocalDate.now(clock));
        member.setFitnessLevel("beginner");
        user.setMember(member);
        userRepository.save(user);
        return user;
    }

    /**
     * Tìm tài khoản cho người dùng Google: ưu tiên theo Google sub, sau đó theo email. Khi liên kết theo email:
     * từ chối nếu tài khoản đã liên kết với Google sub khác, hoặc email không phải Gmail/Google Workspace mà
     * chưa liên kết trước (tránh chiếm tài khoản qua email trùng). Bổ sung ảnh và họ tên nếu còn trống. Không
     * tìm thấy thì tạo tài khoản MEMBER mới.
     */
    private User resolveOrCreateGoogleUser(
            GoogleUserInfo googleUser,
            String initialStatusForNewUser,
            boolean saveImmediatelyOnEmailLink) {
        String email = normalize(googleUser.email());
        String googleSub = googleUser.sub();

        Optional<User> bySub = (googleSub != null && !googleSub.isBlank())
                ? userRepository.findByGoogleSub(googleSub)
                : Optional.empty();
        Optional<User> byEmail = userRepository.findByEmailIgnoreCase(email);

        if (bySub.isPresent()) {
            return bySub.get();
        }
        if (byEmail.isPresent()) {
            User user = byEmail.get();
            String linkedSub = user.getGoogleSub();
            if (linkedSub != null && !linkedSub.isBlank() && !linkedSub.equals(googleSub)) {
                throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
            }
            boolean googleManagedEmail = email.endsWith("@gmail.com")
                    || (googleUser.hostedDomain() != null && !googleUser.hostedDomain().isBlank());
            if ((linkedSub == null || linkedSub.isBlank()) && !googleManagedEmail) {
                throw new UnauthorizedException("GOOGLE_ACCOUNT_LINK_REQUIRED", "auth.google.link_required", null, null);
            }
            ensureGoogleOtpAccountAllowed(user);
            boolean unverifiedStub = (linkedSub == null || linkedSub.isBlank())
                    && "inactive".equalsIgnoreCase(user.getStatus());
            if (unverifiedStub) {
                // Chống Pre-Account Hijacking: vô hiệu hóa hoàn toàn mật khẩu, username, SĐT và họ tên do kẻ tấn công đăng ký trước.
                String previousUsername = user.getUsername();
                String previousPhone = user.getPhone();
                user.setPasswordHash(passwordEncoder.encode(generateRandomPassword()));
                user.setUsername(generateUniqueUsernameFromEmail(email, previousUsername));
                user.setPhone(null);
                user.setFullName(googleUser.name() != null && !googleUser.name().isBlank()
                        ? googleUser.name()
                        : user.getUsername());
                if (googleUser.picture() != null && !googleUser.picture().isBlank()) {
                    user.setAvatarUrl(googleUser.picture());
                }
                if ("active".equalsIgnoreCase(initialStatusForNewUser)) {
                    user.setStatus("active");
                }
                if (previousPhone != null && !previousPhone.isBlank()) {
                    String normalizedOldPhone = normalize(previousPhone);
                    runAfterCommit(() -> otpService.invalidate(normalizedOldPhone));
                }
            } else {
                if (googleUser.picture() != null && (user.getAvatarUrl() == null || user.getAvatarUrl().isBlank())) {
                    user.setAvatarUrl(googleUser.picture());
                }
                if (googleUser.name() != null && !googleUser.name().isBlank()
                        && (user.getFullName() == null || user.getFullName().equals(user.getUsername()))) {
                    user.setFullName(googleUser.name());
                }
            }
            user.setGoogleSub(googleSub);
            user.setUpdatedAt(LocalDateTime.now(clock));
            if (saveImmediatelyOnEmailLink) {
                userRepository.save(user);
            }
            return user;
        }

        String username = generateUniqueUsernameFromEmail(email);
        return createMemberAccount(
                username,
                googleUser.name(),
                email,
                null,
                generateRandomPassword(),
                googleSub,
                googleUser.picture(),
                initialStatusForNewUser);
    }

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuthService.class);

    /**
     * Sinh OTP gắn mục đích cụ thể và gửi email sau khi transaction commit (để không gửi mã cho dữ liệu bị
     * rollback). Gửi lỗi thì hủy mã đã sinh và báo lỗi 503 cho người dùng. Ở chế độ debug OTP thì không gửi
     * email.
     */
    private String issueAndSendOtp(String normalizedTarget, OtpPurpose purpose) {
        String code = otpService.generateOtp(normalizedTarget, purpose);
        if (!debugOtpEnabled) {
            runAfterCommit(() -> {
                try {
                    otpDeliveryPort.send(normalizedTarget, code);
                } catch (RuntimeException deliveryFailure) {
                    otpService.invalidate(normalizedTarget);
                    log.warn("OTP delivery failed for {}", maskEmail(normalizedTarget), deliveryFailure);
                    // Ngoại lệ afterCommit lan lên người gọi, nên người dùng được báo là mã chưa được gửi.
                    if (deliveryFailure instanceof com.swp391.scms.common.exception.AppException) {
                        throw deliveryFailure;
                    }
                    throw new com.swp391.scms.common.exception.ServiceUnavailableException(
                            "OTP_DELIVERY_FAILED", "auth.otp.delivery_failed", null, null);
                }
            });
        }
        return code;
    }

    /** Chạy hành động sau khi transaction hiện tại commit; nếu không có transaction thì chạy ngay. */
    private void runAfterCommit(Runnable action) {
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        /** Được Spring gọi khi transaction commit thành công. */
                        @Override
                        public void afterCommit() {
                            action.run();
                        }
                    });
        } else {
            action.run();
        }
    }

    /** Che email khi ghi log, ví dụ "a***@gmail.com", để không lộ thông tin cá nhân. */
    private static String maskEmail(String target) {
        if (target == null || target.isBlank()) {
            return "***";
        }
        int at = target.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return target.charAt(0) + "***" + target.substring(at);
    }

    /**
     * Đăng nhập Google bằng ID Token: xác minh chữ ký/audience/hạn dùng, email phải đã xác minh, tìm hoặc tạo
     * tài khoản MEMBER active, từ chối tài khoản bị khóa/xóa, rồi cấp JWT.
     */
    @Transactional
    public AuthTokenResponse loginWithGoogle(GoogleLoginRequest request) {
        if (request == null || request.idToken() == null || request.idToken().isBlank()) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google ID Token is missing");
        }

        if (googleTokenVerifierPort == null) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google Token Verifier is not available");
        }

        // BR-01: Xác minh chữ ký token, aud, iss, exp.
        GoogleUserInfo googleUser = googleTokenVerifierPort.verify(request.idToken());

        // BR-02: Chỉ chấp nhận email_verified = true.
        if (!googleUser.emailVerified()) {
            throw new UnauthorizedException("GOOGLE_EMAIL_NOT_VERIFIED", "auth.google.email_not_verified", null, "Google email is not verified");
        }

        // BR-03 & BR-04: Khớp theo googleSub/email hoặc tự tạo tài khoản MEMBER đang hoạt động.
        User user = resolveOrCreateGoogleUser(googleUser, "active", false);

        // Tài khoản nhân viên hiện có giữ vai trò trong database; tài khoản Google mới luôn là Member.
        ensureGoogleOtpAccountAllowed(user);

        // BR-06: Từ chối tài khoản bị khóa / không hoạt động / đã xóa.
        if (user.getDeletedAt() != null || !"active".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, "Account is deactivated or locked");
        }

        // BR-07: Cấp JWT chuẩn và cập nhật thời điểm đăng nhập gần nhất.
        user.setLastLoginAt(LocalDateTime.now(clock));
        user.setUpdatedAt(LocalDateTime.now(clock));
        userRepository.save(user);

        return issueTokenForUser(user);
    }

    /**
     * Kiểm tra OTP theo đúng mục đích và đổi kết quả thành lỗi tương ứng: hết hạn/không có/sai mục đích (400),
     * sai quá số lần (429), sai mã (400 kèm số lần còn lại).
     */
    private OtpService.Status verifyOtpChallenge(String target, String otpCode, OtpPurpose purpose) {
        OtpService.Status status = otpService.verifyOtp(target, otpCode, purpose);
        return switch (status.result()) {
            case EXPIRED_OR_NOT_FOUND -> throw new BadRequestException("OTP_EXPIRED", "auth.otp.expired", null, null);
            case MAX_ATTEMPTS_EXCEEDED -> throw new TooManyRequestsException("MAX_ATTEMPTS", "auth.otp.max_attempts", null, null);
            case INVALID_CODE -> throw new BadRequestException("INVALID_OTP", "auth.otp.invalid",
                    new Object[]{status.remainingAttempts()}, null);
            case SUCCESS -> status;
        };
    }

    /** Yêu cầu tài khoản đã hoàn tất xác minh Google OAuth (có google_sub) trước khi dùng luồng Google OTP. */
    private void requireGoogleLinkedAccount(User user) {
        if (user.getGoogleSub() == null || user.getGoogleSub().isBlank()) {
            throw new UnauthorizedException("GOOGLE_AUTH_REQUIRED", "auth.google.state_invalid", null,
                    "Google OAuth verification is required");
        }
    }

    /** Sinh mật khẩu ngẫu nhiên an toàn bằng SecureRandom (32 byte -> 43 ký tự Base64URL, dưới giới hạn 72 byte của BCrypt). */
    private static String generateRandomPassword() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Tên đăng nhập hợp lệ: 3–50 ký tự gồm chữ cái, chữ số, dấu chấm, gạch dưới, gạch nối (không chứa @ hoặc khoảng trắng). */
    private boolean isValidUsername(String rawUsername) {
        return rawUsername != null && USERNAME_PATTERN.matcher(rawUsername).matches();
    }

    /**
     * Chỉ cho đăng nhập Google/OTP với vai trò MEMBER, COACH, RECEPTIONIST (quản lý/admin phải dùng mật khẩu).
     * Tài khoản phải active, riêng hội viên được phép đang chờ kích hoạt; tài khoản đã xóa bị từ chối.
     */
    private void ensureGoogleOtpAccountAllowed(User user) {
        if (user.getRole() == null || !java.util.Set.of("MEMBER", "COACH", "RECEPTIONIST")
                .contains(user.getRole().getCode().toUpperCase(Locale.ROOT))) {
            throw new ForbiddenException("STAFF_GOOGLE_NOT_ALLOWED", "auth.google.staff_not_allowed", null, null);
        }
        String status = user.getStatus();
        boolean allowedStatus = "active".equalsIgnoreCase(status)
                || ("MEMBER".equalsIgnoreCase(user.getRole().getCode()) && "inactive".equalsIgnoreCase(status));
        if (user.getDeletedAt() != null || !allowedStatus) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }
    }

    /** Cấp JWT cho người dùng (dùng email làm tên nếu không có tên đăng nhập) kèm vai trò và họ tên. */
    private AuthTokenResponse issueTokenForUser(User user) {
        String username = user.getUsername() == null ? user.getEmail() : user.getUsername();
        String role = user.getRole().getCode();
        return new AuthTokenResponse(jwtService.generateToken(user.getId(), username, role), username, role, user.getFullName());
    }

    /**
     * Kiểm tra email: tối đa 150 ký tự, đúng dạng, chặn các domain gõ nhầm của Gmail (gmail.co, gmial.com...),
     * và với Gmail thì phần trước @ chỉ được chữ, số, dấu chấm và dấu +.
     */
    private boolean isValidEmail(String rawEmail) {
        if (rawEmail == null) {
            return false;
        }
        String trimmed = rawEmail.trim();
        if (trimmed.isEmpty() || trimmed.length() > 150
                || !trimmed.matches("^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}$")) {
            return false;
        }
        String[] parts = trimmed.split("@", 2);
        String localPart = parts[0];
        String domain = parts[1].toLowerCase(Locale.ROOT);
        if (domain.matches("^(gmail\\.(?!com$).+|(gmai|gmial|gmal|gamil)\\..+)$")) {
            return false;
        }
        if ("gmail.com".equals(domain) || "googlemail.com".equals(domain)) {
            return localPart.matches("^[a-zA-Z0-9]+(\\.[a-zA-Z0-9]+)*(\\+[a-zA-Z0-9._-]+)?$");
        }
        return true;
    }

    /** SĐT Việt Nam: bắt đầu bằng 0 hoặc +84, tiếp theo là đầu số 3/5/7/8/9 và 8 chữ số. */
    private boolean isValidPhone(String rawPhone) {
        return rawPhone != null && rawPhone.matches("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");
    }

    /** Chuẩn hóa chuỗi: bỏ khoảng trắng hai đầu và chuyển chữ thường. */
    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
