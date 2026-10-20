package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.TooManyRequestsException;
import com.swp391.scms.common.exception.UnauthorizedException;
import com.swp391.scms.security.JwtService;
import com.swp391.scms.users.RoleRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock OtpService otpService;
    @Mock OtpDeliveryPort otpDeliveryPort;
    @Mock GoogleTokenVerifier googleTokenVerifier;
    @Mock com.swp391.scms.audit.AuditLogRepository auditLogRepository;
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(userRepository, roleRepository, passwordEncoder, jwtService, otpService,
                otpDeliveryPort, Clock.systemUTC(), false, null, googleTokenVerifier, auditLogRepository);
    }

    private User pendingUser() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setStatus("inactive");
        return user;
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.findByUsernameIgnoreCase("newuser")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "a@b.com", null)));
        verify(userRepository, org.mockito.Mockito.never()).saveAndFlush(any());
    }

    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.findByUsernameIgnoreCase("taken")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("taken", "secret1", "x@y.com", null)));
    }

    @Test
    void registerRejectsDuplicatePhone() {
        when(userRepository.findByUsernameIgnoreCase("newuser")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(userRepository.findByPhone("0912345678")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "a@b.com", "0912345678", null)));
        verify(userRepository, org.mockito.Mockito.never()).saveAndFlush(any());
    }

    @Test
    void verifyOtpActivatesPendingAccount() {
        User user = pendingUser();
        when(otpService.verifyOtp("a@b.com", "123456"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(user));

        service.verifyOtp(new VerifyOtpRequest("a@b.com", "123456"));

        assertEquals("active", user.getStatus());
        verify(userRepository).save(user);
    }

    @Test
    void verifyOtpMapsExpiredToBadRequest() {
        when(otpService.verifyOtp("a@b.com", "123456"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, 0));

        assertThrows(BadRequestException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "123456")));
    }

    @Test
    void verifyOtpMapsInvalidCodeToBadRequest() {
        when(otpService.verifyOtp("a@b.com", "000000"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.INVALID_CODE, 2));

        assertThrows(BadRequestException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "000000")));
    }

    @Test
    void verifyOtpMapsLockoutToTooManyRequests() {
        when(otpService.verifyOtp("a@b.com", "000000"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.MAX_ATTEMPTS_EXCEEDED, 0));

        assertThrows(TooManyRequestsException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "000000")));
    }

    @Test
    void generateOtpRejectsAccountThatIsNotPending() {
        User active = pendingUser();
        active.setStatus("active");
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(active));

        assertThrows(BadRequestException.class, () -> service.generateOtp("a@b.com"));
    }

    @Test
    void requestGoogleOtpCreatesPendingMemberWhenEmailDoesNotExist() {
        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        when(userRepository.findByEmailIgnoreCase("new@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("new")).thenReturn(Optional.empty());
        when(roleRepository.findByCodeIgnoreCase("MEMBER")).thenReturn(Optional.of(memberRole));
        when(passwordEncoder.encode(any())).thenReturn("hashed");
        when(otpService.generateOtp("new@gmail.com")).thenReturn("123456");

        String code = service.requestGoogleOtp("New@gmail.com");

        assertEquals("123456", code);
        verify(userRepository).saveAndFlush(any(User.class));
        verify(otpDeliveryPort).send("new@gmail.com", "123456");
    }

    @Test
    void requestGoogleOtpRejectsLockedOrDeletedAccount() {
        User lockedUser = pendingUser();
        lockedUser.setStatus("locked");
        when(userRepository.findByEmailIgnoreCase("locked@gmail.com")).thenReturn(Optional.of(lockedUser));

        assertThrows(ForbiddenException.class, () -> service.requestGoogleOtp("locked@gmail.com"));

        User deletedUser = pendingUser();
        deletedUser.setDeletedAt(LocalDateTime.now());
        when(userRepository.findByEmailIgnoreCase("deleted@gmail.com")).thenReturn(Optional.of(deletedUser));

        assertThrows(ForbiddenException.class, () -> service.requestGoogleOtp("deleted@gmail.com"));
    }

    @Test
    void verifyGoogleOtpActivatesPendingUserAndIssuesJwt() {
        User user = pendingUser();
        user.setId(42L);
        user.setUsername("member42");
        user.setEmail("member42@gmail.com");
        Role role = new Role();
        role.setCode("MEMBER");
        user.setRole(role);

        when(otpService.verifyOtp("member42@gmail.com", "123456"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("member42@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(42L, "member42", "MEMBER")).thenReturn("jwt-42");

        var res = service.verifyGoogleOtp("member42@gmail.com", "123456");

        assertEquals("active", user.getStatus());
        assertEquals("jwt-42", res.token());
        assertEquals("MEMBER", res.role());
        verify(userRepository).save(user);
    }

    @Test
    void verifyGoogleOtpRejectsLockedAccountWithoutReactivatingIt() {
        User locked = pendingUser();
        locked.setStatus("locked");
        when(otpService.verifyOtp("locked@gmail.com", "123456"))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("locked@gmail.com")).thenReturn(Optional.of(locked));

        assertThrows(ForbiddenException.class, () -> service.verifyGoogleOtp("locked@gmail.com", "123456"));
        assertEquals("locked", locked.getStatus());
        verify(userRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void loginWithGoogleRejectsInvalidOrExpiredToken() {
        when(googleTokenVerifier.verify("invalid-token")).thenReturn(null);

        assertThrows(UnauthorizedException.class, () -> service.loginWithGoogle("invalid-token"));
    }

    @Test
    void loginWithGoogleRejectsUnverifiedEmail() {
        when(googleTokenVerifier.verify("unverified-token"))
                .thenReturn(new GoogleTokenPayload("sub-123", "unverified@gmail.com", false, "Test", null));

        assertThrows(UnauthorizedException.class, () -> service.loginWithGoogle("unverified-token"));
    }

    @Test
    void loginWithGoogleExistingMemberLoginSuccess() {
        User user = new User();
        user.setId(10L);
        user.setUsername("existing_member");
        user.setEmail("existing@gmail.com");
        user.setStatus("active");
        Role role = new Role();
        role.setCode("MEMBER");
        user.setRole(role);

        when(googleTokenVerifier.verify("valid-token"))
                .thenReturn(new GoogleTokenPayload("google-sub-10", "existing@gmail.com", true, "Existing Member", "http://avatar.jpg"));
        when(userRepository.findByGoogleSubAndDeletedAtIsNull("google-sub-10")).thenReturn(Optional.of(user));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("existing@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(10L, "existing_member", "MEMBER")).thenReturn("jwt-member-10");

        var response = service.loginWithGoogle("valid-token");

        assertEquals("jwt-member-10", response.token());
        assertEquals("existing_member", response.username());
        assertEquals("MEMBER", response.role());
        verify(userRepository).save(user);
    }

    @Test
    void loginWithGoogleNewMemberAutoCreated() {
        when(googleTokenVerifier.verify("new-token"))
                .thenReturn(new GoogleTokenPayload("google-sub-99", "newuser@gmail.com", true, "New Member", null));
        when(userRepository.findByGoogleSubAndDeletedAtIsNull("google-sub-99")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("newuser@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("newuser")).thenReturn(Optional.empty());

        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        when(roleRepository.findByCodeIgnoreCase("MEMBER")).thenReturn(Optional.of(memberRole));
        when(passwordEncoder.encode(any())).thenReturn("random-hashed-pwd");

        when(userRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(99L);
            return u;
        });
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(99L, "newuser", "MEMBER")).thenReturn("jwt-new-99");

        var response = service.loginWithGoogle("new-token");

        assertEquals("jwt-new-99", response.token());
        assertEquals("MEMBER", response.role());
        verify(userRepository, org.mockito.Mockito.atLeastOnce()).save(any());
    }

    @Test
    void loginWithGoogleRejectsStaffAccount() {
        User staff = new User();
        staff.setId(5L);
        staff.setUsername("coach_staff");
        staff.setEmail("coach@gym.com");
        staff.setStatus("active");
        Role coachRole = new Role();
        coachRole.setCode("COACH");
        staff.setRole(coachRole);

        when(googleTokenVerifier.verify("staff-token"))
                .thenReturn(new GoogleTokenPayload("google-sub-coach", "coach@gym.com", true, "Coach Staff", null));
        when(userRepository.findByGoogleSubAndDeletedAtIsNull("google-sub-coach")).thenReturn(Optional.of(staff));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("coach@gym.com")).thenReturn(Optional.of(staff));

        assertThrows(ForbiddenException.class, () -> service.loginWithGoogle("staff-token"));
    }

    @Test
    void loginWithGoogleRejectsLockedAccount() {
        User locked = new User();
        locked.setId(7L);
        locked.setUsername("locked_member");
        locked.setEmail("locked@gmail.com");
        locked.setStatus("locked");
        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        locked.setRole(memberRole);

        when(googleTokenVerifier.verify("locked-token"))
                .thenReturn(new GoogleTokenPayload("google-sub-locked", "locked@gmail.com", true, "Locked Member", null));
        when(userRepository.findByGoogleSubAndDeletedAtIsNull("google-sub-locked")).thenReturn(Optional.of(locked));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("locked@gmail.com")).thenReturn(Optional.of(locked));

        assertThrows(ForbiddenException.class, () -> service.loginWithGoogle("locked-token"));
    }
}