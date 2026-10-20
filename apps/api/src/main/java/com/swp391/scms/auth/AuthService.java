package com.swp391.scms.auth;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.exception.TooManyRequestsException;
import com.swp391.scms.common.exception.UnauthorizedException;
import com.swp391.scms.auth.dto.AuthTokenResponse;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final OtpDeliveryPort otpDeliveryPort;
    private final boolean debugOtpEnabled;
    private final Clock clock;
    private final MessageService messageService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final com.swp391.scms.audit.AuditLogRepository auditLogRepository;

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, null, null, null);
    }

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, messageService, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService,
                       GoogleTokenVerifier googleTokenVerifier,
                       com.swp391.scms.audit.AuditLogRepository auditLogRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.otpDeliveryPort = otpDeliveryPort;
        this.debugOtpEnabled = debugOtpEnabled;
        this.clock = clock;
        this.messageService = messageService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.auditLogRepository = auditLogRepository;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Transactional
    public AuthTokenResponse login(LoginRequest request) {
        User user = userRepository.findActiveByIdentifier(normalize(request.username()))
                .orElseThrow(() -> new UnauthorizedException("INVALID_CREDENTIALS", "auth.login.invalid_credentials", null, null));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "auth.login.invalid_credentials", null, null);
        }
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }

        user.setLastLoginAt(LocalDateTime.now(clock));
        return issueTokenForUser(user);
    }

    @Transactional
    public RegistrationResponse register(RegisterRequest request) {
        String username = normalize(request.username());
        String email = normalize(request.email());
        if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new ConflictException("USERNAME_EXISTS", "auth.register.username_exists", null, null);
        }
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ConflictException("EMAIL_EXISTS", "auth.register.email_exists", null, null);
        }
        String phone = null;
        if (request.phone() != null && !request.phone().isBlank()) {
            phone = request.phone().trim();
            if (userRepository.findByPhone(phone).isPresent()) {
                throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null);
            }
        }

        User user = createPendingMemberUser(username, email, phone, request.password());
        return new RegistrationResponse(
                msg("auth.register.success"),
                user.getId(), username);
    }

    @Transactional
    public OtpService.Status verifyOtp(VerifyOtpRequest request) {
        OtpService.Status status = verifyOtpChallenge(request.target(), request.otpCode());
        activateAccount(request.target());
        return status;
    }

    @Transactional(readOnly = true)
    public User findOtpTarget(String target) {
        String normalizedTarget = normalize(target);
        return (normalizedTarget.contains("@")
                ? userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(normalizedTarget)
                : userRepository.findByPhoneAndDeletedAtIsNull(normalizedTarget))
                .orElseThrow(() -> new ResourceNotFoundException("resource.account", target));
    }

    public String generateOtp(String target) {
        findPendingUser(target);
        return issueAndSendOtp(normalize(target));
    }

    private void activateAccount(String target) {
        User user = findPendingUser(target);
        user.setStatus("active");
        user.setUpdatedAt(LocalDateTime.now(clock));
        userRepository.save(user);
    }

    private User findPendingUser(String target) {
        User user = findOtpTarget(target);
        if (!"inactive".equalsIgnoreCase(user.getStatus())) {
            throw new BadRequestException("ACCOUNT_NOT_PENDING", "auth.account.not_pending", null, null);
        }
        return user;
    }

    @Transactional
    public String requestGoogleOtp(String rawEmail) {
        if (!isValidEmail(rawEmail)) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        String email = normalize(rawEmail);

        java.util.Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            String baseUsername = email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "");
            if (baseUsername.length() < 3) {
                baseUsername = "user_" + baseUsername;
            }
            if (baseUsername.length() > 40) {
                baseUsername = baseUsername.substring(0, 40);
            }
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
                username = baseUsername + suffix++;
            }
            createPendingMemberUser(username, email, null, java.util.UUID.randomUUID().toString());
        } else {
            User user = userOpt.get();
            ensureGoogleOtpAccountAllowed(user);
        }

        return issueAndSendOtp(email);
    }

    @Transactional
    public AuthTokenResponse verifyGoogleOtp(String rawEmail, String otpCode) {
        if (!isValidEmail(rawEmail)) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, null);
        }
        if (otpCode == null || otpCode.isBlank()) {
            throw new BadRequestException("INVALID_OTP", "validation.auth.otp.not_blank", null, null);
        }
        String email = normalize(rawEmail);
        verifyOtpChallenge(email, otpCode.trim());

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("resource.account", email));
        ensureGoogleOtpAccountAllowed(user);

        LocalDateTime now = LocalDateTime.now(clock);
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            user.setStatus("active");
        }
        user.setLastLoginAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        return issueTokenForUser(user);
    }

    private User createPendingMemberUser(String username, String email, String phone, String rawPassword) {
        Role memberRole = roleRepository.findByCodeIgnoreCase("MEMBER")
                .orElseThrow(() -> new ResourceNotFoundException("resource.role_member", "MEMBER"));

        User user = new User();
        user.setUsername(username);
        user.setRole(memberRole);
        user.setFullName(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setStatus("inactive");
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

    private String issueAndSendOtp(String normalizedTarget) {
        String code = otpService.generateOtp(normalizedTarget);
        if (!debugOtpEnabled) {
            try {
                otpDeliveryPort.send(normalizedTarget, code);
            } catch (RuntimeException deliveryFailure) {
                otpService.invalidate(normalizedTarget);
                throw deliveryFailure;
            }
        }
        return code;
    }

    private OtpService.Status verifyOtpChallenge(String target, String otpCode) {
        OtpService.Status status = otpService.verifyOtp(target, otpCode);
        return switch (status.result()) {
            case EXPIRED_OR_NOT_FOUND -> throw new BadRequestException("OTP_EXPIRED", "auth.otp.expired", null, null);
            case MAX_ATTEMPTS_EXCEEDED -> throw new TooManyRequestsException("MAX_ATTEMPTS", "auth.otp.max_attempts", null, null);
            case INVALID_CODE -> throw new BadRequestException("INVALID_OTP", "auth.otp.invalid",
                    new Object[]{status.remainingAttempts()}, null);
            case SUCCESS -> status;
        };
    }

    private void ensureGoogleOtpAccountAllowed(User user) {
        String status = user.getStatus();
        boolean allowedStatus = "active".equalsIgnoreCase(status) || "inactive".equalsIgnoreCase(status);
        if (user.getDeletedAt() != null || !allowedStatus) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }
    }

    private AuthTokenResponse issueTokenForUser(User user) {
        String username = user.getUsername() == null ? user.getEmail() : user.getUsername();
        String role = user.getRole().getCode();
        return new AuthTokenResponse(jwtService.generateToken(user.getId(), username, role), username, role);
    }

    private boolean isValidEmail(String rawEmail) {
        if (rawEmail == null) {
            return false;
        }
        String trimmed = rawEmail.trim();
        return !trimmed.isEmpty() && trimmed.length() <= 150 && trimmed.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    }

    @Transactional
    public AuthTokenResponse loginWithGoogle(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
        }

        GoogleTokenPayload payload = googleTokenVerifier != null ? googleTokenVerifier.verify(idToken) : null;
        if (payload == null) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
        }

        if (!payload.emailVerified()) {
            throw new UnauthorizedException("GOOGLE_EMAIL_NOT_VERIFIED", "auth.google.email_unverified", null, null);
        }

        String email = normalize(payload.email());
        String sub = payload.sub();

        Optional<User> bySub = (sub != null && !sub.isBlank())
                ? userRepository.findByGoogleSubAndDeletedAtIsNull(sub)
                : Optional.empty();
        Optional<User> byEmail = userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(email);

        User user;
        if (bySub.isPresent() && byEmail.isPresent()) {
            if (!bySub.get().getId().equals(byEmail.get().getId())) {
                throw new ConflictException("GOOGLE_SUB_CONFLICT", "auth.google.sub_conflict", null, null);
            }
            user = bySub.get();
        } else if (bySub.isPresent()) {
            user = bySub.get();
        } else if (byEmail.isPresent()) {
            user = byEmail.get();
            // Link google_sub if not yet set
            if (sub != null && !sub.isBlank()) {
                Optional<User> existingSub = userRepository.findByGoogleSub(sub);
                if (existingSub.isPresent() && !existingSub.get().getId().equals(user.getId())) {
                    throw new ConflictException("GOOGLE_SUB_CONFLICT", "auth.google.sub_conflict", null, null);
                }
                user.setGoogleSub(sub);
                user.setUpdatedAt(LocalDateTime.now(clock));
                userRepository.save(user);
            }
        } else {
            // BR-04: Tạo tài khoản mới vai trò MEMBER, trạng thái active và bản ghi members tương ứng
            Role memberRole = roleRepository.findByCodeIgnoreCase("MEMBER")
                    .orElseThrow(() -> new ResourceNotFoundException("resource.role_member", "MEMBER"));

            String baseUsername = email.contains("@") ? email.split("@")[0] : email;
            String username = baseUsername;
            if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
                username = baseUsername + "_" + (System.currentTimeMillis() % 10000);
            }

            user = new User();
            user.setUsername(username);
            user.setRole(memberRole);
            user.setFullName(payload.name() != null && !payload.name().isBlank() ? payload.name() : username);
            user.setEmail(email);
            user.setGoogleSub(sub);
            user.setAvatarUrl(payload.picture());
            user.setPasswordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
            user.setStatus("active");
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

            recordAuditLog(user, "REGISTER_GOOGLE");
        }

        // BR-05: Chỉ vai trò MEMBER được đăng nhập bằng Google; nhân sự bị từ chối 403
        if (user.getRole() == null || !"MEMBER".equalsIgnoreCase(user.getRole().getCode())) {
            throw new ForbiddenException("STAFF_GOOGLE_LOGIN_FORBIDDEN", "auth.google.staff_forbidden", null, null);
        }

        // BR-06: Tài khoản bị khóa (locked) hoặc inactive bị từ chối
        if ("locked".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_LOCKED", "auth.google.account_locked", null, null);
        }
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("ACCOUNT_INACTIVE", "auth.account.inactive", null, null);
        }

        // BR-07: Cấp JWT đồng nhất + ghi audit log đăng nhập
        user.setLastLoginAt(LocalDateTime.now(clock));
        userRepository.save(user);
        recordAuditLog(user, "LOGIN_GOOGLE");

        return issueTokenForUser(user);
    }

    private void recordAuditLog(User user, String action) {
        if (auditLogRepository == null) return;
        try {
            com.swp391.scms.audit.AuditLog entry = new com.swp391.scms.audit.AuditLog();
            entry.setUserId(user.getId());
            entry.setAction(action);
            entry.setEntityType("users");
            entry.setEntityId(user.getId());
            entry.setNewValue("{\"email\":\"" + user.getEmail() + "\",\"role\":\"" + (user.getRole() != null ? user.getRole().getCode() : "MEMBER") + "\"}");
            auditLogRepository.save(entry);
        } catch (Exception ignored) {
            // Audit log write should not block login flow
        }
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
