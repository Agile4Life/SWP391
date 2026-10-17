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

    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled) {
        this(userRepository, roleRepository, passwordEncoder, jwtService, otpService, otpDeliveryPort, clock, debugOtpEnabled, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       OtpService otpService, OtpDeliveryPort otpDeliveryPort, Clock clock,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.debug-otp-enabled:false}") boolean debugOtpEnabled,
                       MessageService messageService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.otpDeliveryPort = otpDeliveryPort;
        this.debugOtpEnabled = debugOtpEnabled;
        this.clock = clock;
        this.messageService = messageService;
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
        String username = user.getUsername() == null ? user.getEmail() : user.getUsername();
        String role = user.getRole().getCode();
        return new AuthTokenResponse(jwtService.generateToken(user.getId(), username, role), username, role);
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

        Role memberRole = roleRepository.findByCodeIgnoreCase("MEMBER")
                .orElseThrow(() -> new ResourceNotFoundException("resource.role_member", "MEMBER"));

        User user = new User();
        user.setUsername(username);
        user.setRole(memberRole);
        user.setFullName(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
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

        return new RegistrationResponse(
                msg("auth.register.success"),
                user.getId(), username);
    }

    @Transactional
    public OtpService.Status verifyOtp(VerifyOtpRequest request) {
        OtpService.Status status = otpService.verifyOtp(request.target(), request.otpCode());
        switch (status.result()) {
            case EXPIRED_OR_NOT_FOUND -> throw new BadRequestException("OTP_EXPIRED", "auth.otp.expired", null, null);
            case MAX_ATTEMPTS_EXCEEDED -> throw new TooManyRequestsException("MAX_ATTEMPTS", "auth.otp.max_attempts", null, null);
            case INVALID_CODE -> throw new BadRequestException("INVALID_OTP", "auth.otp.invalid",
                    new Object[]{status.remainingAttempts()}, null);
            case SUCCESS -> activateAccount(request.target());
        }
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
        String code = otpService.generateOtp(normalize(target));
        if (!debugOtpEnabled) {
            try {
                otpDeliveryPort.send(normalize(target), code);
            } catch (RuntimeException deliveryFailure) {
                otpService.invalidate(normalize(target));
                throw deliveryFailure;
            }
        }
        return code;
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
        if (rawEmail == null || !rawEmail.contains("@")) {
            throw new BadRequestException("INVALID_EMAIL", "auth.register.invalid_email", null, "Email is invalid");
        }
        String email = normalize(rawEmail);

        java.util.Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        User user;
        if (userOpt.isEmpty()) {
            Role memberRole = roleRepository.findByCodeIgnoreCase("MEMBER")
                    .orElseThrow(() -> new ResourceNotFoundException("resource.role_member", "MEMBER"));

            String baseUsername = email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "");
            if (baseUsername.length() < 3) baseUsername = "user_" + baseUsername;
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
                username = baseUsername + suffix++;
            }

            user = new User();
            user.setUsername(username);
            user.setRole(memberRole);
            user.setFullName(username);
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
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
        } else {
            user = userOpt.get();
            if (user.getDeletedAt() != null) {
                throw new BadRequestException("ACCOUNT_INACTIVE", "auth.account.inactive", null, "Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động");
            }
        }

        String code = otpService.generateOtp(email);
        if (!debugOtpEnabled) {
            try {
                otpDeliveryPort.send(email, code);
            } catch (RuntimeException deliveryFailure) {
                otpService.invalidate(email);
                throw deliveryFailure;
            }
        }
        return code;
    }

    @Transactional
    public AuthTokenResponse verifyGoogleOtp(String rawEmail, String otpCode) {
        String email = normalize(rawEmail);
        OtpService.Status status = otpService.verifyOtp(email, otpCode);
        switch (status.result()) {
            case EXPIRED_OR_NOT_FOUND -> throw new BadRequestException("OTP_EXPIRED", "auth.otp.expired", null, null);
            case MAX_ATTEMPTS_EXCEEDED -> throw new TooManyRequestsException("MAX_ATTEMPTS", "auth.otp.max_attempts", null, null);
            case INVALID_CODE -> throw new BadRequestException("INVALID_OTP", "auth.otp.invalid",
                    new Object[]{status.remainingAttempts()}, null);
            case SUCCESS -> {
                User user = userRepository.findByEmailIgnoreCase(email)
                        .orElseThrow(() -> new ResourceNotFoundException("resource.account", email));
                if (user.getDeletedAt() != null) {
                    throw new BadRequestException("ACCOUNT_INACTIVE", "auth.account.inactive", null, "Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động");
                }
                user.setStatus("active");
                user.setLastLoginAt(LocalDateTime.now(clock));
                user.setUpdatedAt(LocalDateTime.now(clock));
                userRepository.save(user);

                String username = user.getUsername() == null ? user.getEmail() : user.getUsername();
                String role = user.getRole().getCode();
                return new AuthTokenResponse(jwtService.generateToken(user.getId(), username, role), username, role);
            }
        }
        throw new BadRequestException("OTP_VERIFICATION_FAILED", "auth.otp.invalid", null, null);
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
