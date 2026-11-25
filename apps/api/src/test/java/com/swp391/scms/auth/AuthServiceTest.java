package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.swp391.scms.auth.entity.OtpChallenge;
import com.swp391.scms.auth.repository.OtpChallengeRepository;
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
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.SimpleTransactionStatus;

/** Bộ kiểm thử cho service AuthService (auth service). */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock OtpService otpService;
    @Mock OtpDeliveryPort otpDeliveryPort;
    private AuthService service;

    /** Chuẩn bị trước mỗi test: tạo AuthService với repository và mã hóa giả lập. */
    @BeforeEach
    void setUp() {
        service = new AuthService(userRepository, roleRepository, passwordEncoder, jwtService, otpService,
                otpDeliveryPort, Clock.systemUTC(), false);
    }

    /** Hàm trợ giúp của test: tạo người dùng ở trạng thái chờ kích hoạt. */
    private User pendingUser() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setStatus("inactive");
        return user;
    }

    /** Hàm trợ giúp của test: tạo hội viên chờ kích hoạt đã xác minh Google OAuth. */
    private User pendingGoogleMember(Long id, String username, String email, String googleSub) {
        User user = pendingUser();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setGoogleSub(googleSub);
        Role role = new Role();
        role.setCode("MEMBER");
        user.setRole(role);
        return user;
    }

    /** Kiểm thử: đăng ký từ chối email trùng. */
    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.findByUsernameIgnoreCase("newuser")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "a@b.com", null)));
        verify(userRepository, never()).saveAndFlush(any());
    }

    /** Kiểm thử: đăng ký từ chối username trùng. */
    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.findByUsernameIgnoreCase("taken")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("taken", "secret1", "x@y.com", null)));
    }

    /** Kiểm thử P1-BE-01: đăng ký từ chối username chứa @, khoảng trắng, quá ngắn hoặc quá 50 ký tự. */
    @Test
    void registerRejectsUsernameContainingAtSignOrWhitespace() {
        for (String invalid : java.util.List.of("victim@gmail.com", "bad user", "ab", "u".repeat(51))) {
            BadRequestException ex = assertThrows(BadRequestException.class,
                    () -> service.register(new RegisterRequest(invalid, "secret1", "ok@example.com", null)));
            assertEquals("INVALID_USERNAME", ex.getErrorCode());
        }
        verify(userRepository, never()).saveAndFlush(any());
    }

    /** Kiểm thử: đăng ký lưu họ tên thật thay vì định danh đăng nhập. */
    @Test
    void registerStoresTheRealFullNameInsteadOfTheLoginIdentifier() {
        when(userRepository.findByUsernameIgnoreCase("an.nguyen")).thenReturn(Optional.empty());
        when(roleRepository.findByCodeIgnoreCase("MEMBER")).thenReturn(Optional.of(new Role()));
        when(passwordEncoder.encode(any())).thenReturn("hash");
        service.register(new RegisterRequest("an.nguyen", "secret1", "an@example.com", null, "MEMBER", "  Nguyễn   Văn An "));
        var saved = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals("Nguyễn Văn An", saved.getValue().getFullName());
    }

    /** Kiểm thử: đăng ký không có họ tên thì dùng username thay thế. */
    @Test
    void registerWithoutFullNameStillFallsBackToTheUsername() {
        when(userRepository.findByUsernameIgnoreCase("legacy")).thenReturn(Optional.empty());
        when(roleRepository.findByCodeIgnoreCase("MEMBER")).thenReturn(Optional.of(new Role()));
        when(passwordEncoder.encode(any())).thenReturn("hash");
        service.register(new RegisterRequest("legacy", "secret1", "legacy@example.com", null));
        var saved = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals("legacy", saved.getValue().getFullName());
    }

    /** Kiểm thử: đăng ký từ chối số điện thoại trùng. */
    @Test
    void registerRejectsDuplicatePhone() {
        when(userRepository.findByUsernameIgnoreCase("newuser")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(userRepository.findByPhone("0912345678")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "a@b.com", "0912345678", null)));
        verify(userRepository, never()).saveAndFlush(any());
    }

    /** Kiểm thử: đăng ký từ chối số điện thoại quá ngắn và Gmail không hợp lệ. */
    @Test
    void registerRejectsShortPhoneAndInvalidGmail() {
        assertThrows(BadRequestException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "user@gmail.co", "0912345678", null)));
        assertThrows(BadRequestException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "bad_user@gmail.com", "0912345678", null)));
        assertThrows(BadRequestException.class,
                () -> service.register(new RegisterRequest("newuser", "secret1", "valid@gmail.com", "091234", null)));
    }

    /** Kiểm thử: xác thực OTP kích hoạt tài khoản đang chờ. */
    @Test
    void verifyOtpActivatesPendingAccount() {
        User user = pendingUser();
        when(otpService.verifyOtp("a@b.com", "123456", OtpPurpose.ACCOUNT_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(user));

        service.verifyOtp(new VerifyOtpRequest("a@b.com", "123456"));

        assertEquals("active", user.getStatus());
        verify(userRepository).save(user);
    }

    /** Kiểm thử: OTP hết hạn được ánh xạ thành lỗi 400. */
    @Test
    void verifyOtpMapsExpiredToBadRequest() {
        when(otpService.verifyOtp("a@b.com", "123456", OtpPurpose.ACCOUNT_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, 0));

        assertThrows(BadRequestException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "123456")));
    }

    /** Kiểm thử: mã OTP sai được ánh xạ thành lỗi 400. */
    @Test
    void verifyOtpMapsInvalidCodeToBadRequest() {
        when(otpService.verifyOtp("a@b.com", "000000", OtpPurpose.ACCOUNT_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.INVALID_CODE, 2));

        assertThrows(BadRequestException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "000000")));
    }

    /** Kiểm thử: bị khóa do nhập sai nhiều lần được ánh xạ thành lỗi 429. */
    @Test
    void verifyOtpMapsLockoutToTooManyRequests() {
        when(otpService.verifyOtp("a@b.com", "000000", OtpPurpose.ACCOUNT_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.MAX_ATTEMPTS_EXCEEDED, 0));

        assertThrows(TooManyRequestsException.class, () -> service.verifyOtp(new VerifyOtpRequest("a@b.com", "000000")));
    }

    /** Kiểm thử: không tạo OTP cho tài khoản không ở trạng thái chờ. */
    @Test
    void generateOtpRejectsAccountThatIsNotPending() {
        User active = pendingUser();
        active.setStatus("active");
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(active));

        assertThrows(BadRequestException.class, () -> service.generateOtp("a@b.com"));
    }

    /** Kiểm thử P0-09: /google/send-otp không bao giờ tạo tài khoản mới cho email chưa xác minh Google. */
    @Test
    void requestGoogleOtpRejectsUnknownEmailWithoutCreatingAccount() {
        when(userRepository.findByEmailIgnoreCase("unknown@gmail.com")).thenReturn(Optional.empty());

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> service.requestGoogleOtp("Unknown@gmail.com"));

        assertEquals("GOOGLE_AUTH_REQUIRED", ex.getErrorCode());
        verify(userRepository, never()).saveAndFlush(any());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(otpService, otpDeliveryPort);
    }

    /** Kiểm thử P0-09: /google/send-otp từ chối tài khoản hiện có chưa liên kết Google OAuth (googleSub trống). */
    @Test
    void requestGoogleOtpRejectsAccountWithoutGoogleSub() {
        User unlinked = pendingGoogleMember(12L, "unlinked", "unlinked@gmail.com", null);
        when(userRepository.findByEmailIgnoreCase("unlinked@gmail.com")).thenReturn(Optional.of(unlinked));

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> service.requestGoogleOtp("unlinked@gmail.com"));

        assertEquals("GOOGLE_AUTH_REQUIRED", ex.getErrorCode());
        verifyNoInteractions(otpService, otpDeliveryPort);
    }

    /** Kiểm thử P0-09: /google/send-otp từ chối tài khoản Google đã active (không cho tạo OTP đăng nhập không mật khẩu). */
    @Test
    void requestGoogleOtpRejectsAlreadyActiveGoogleAccount() {
        User activeGoogle = pendingGoogleMember(13L, "active_google", "active@gmail.com", "sub-13");
        activeGoogle.setStatus("active");
        when(userRepository.findByEmailIgnoreCase("active@gmail.com")).thenReturn(Optional.of(activeGoogle));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.requestGoogleOtp("active@gmail.com"));

        assertEquals("ACCOUNT_NOT_PENDING", ex.getErrorCode());
        verifyNoInteractions(otpService, otpDeliveryPort);
    }

    /** Kiểm thử P0-09: /google/send-otp cho phép gửi lại OTP mục đích GOOGLE_ACTIVATION cho hội viên chờ đã xác minh Google. */
    @Test
    void requestGoogleOtpResendsForPendingGoogleVerifiedMember() {
        User pendingGoogle = pendingGoogleMember(14L, "pending_google", "pending@gmail.com", "google-sub-14");
        when(userRepository.findByEmailIgnoreCase("pending@gmail.com")).thenReturn(Optional.of(pendingGoogle));
        when(otpService.generateOtp("pending@gmail.com", OtpPurpose.GOOGLE_ACTIVATION)).thenReturn("123456");

        String code = service.requestGoogleOtp("Pending@gmail.com");

        assertEquals("123456", code);
        verify(userRepository, never()).saveAndFlush(any());
        verify(otpDeliveryPort).send("pending@gmail.com", "123456");
    }

    /** Kiểm thử: yêu cầu OTP Google từ chối tài khoản bị khóa hoặc đã xóa. */
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

    /** Kiểm thử: xác thực OTP Google kích hoạt người dùng chờ đã liên kết Google và cấp JWT. */
    @Test
    void verifyGoogleOtpActivatesPendingUserAndIssuesJwt() {
        User user = pendingGoogleMember(42L, "member42", "member42@gmail.com", "google-sub-42");

        when(otpService.verifyOtp("member42@gmail.com", "123456", OtpPurpose.GOOGLE_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("member42@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(42L, "member42", "MEMBER")).thenReturn("jwt-42");

        var res = service.verifyGoogleOtp("member42@gmail.com", "123456");

        assertEquals("active", user.getStatus());
        assertEquals("jwt-42", res.token());
        assertEquals("MEMBER", res.role());
        verify(userRepository).save(user);
    }

    /** Kiểm thử P0-09: verifyGoogleOtp từ chối tài khoản chưa liên kết Google (googleSub trống) dù OTP khớp. */
    @Test
    void verifyGoogleOtpRejectsAccountWithoutGoogleSub() {
        User unlinked = pendingGoogleMember(43L, "unlinked43", "unlinked43@gmail.com", null);
        when(otpService.verifyOtp("unlinked43@gmail.com", "123456", OtpPurpose.GOOGLE_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("unlinked43@gmail.com")).thenReturn(Optional.of(unlinked));

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> service.verifyGoogleOtp("unlinked43@gmail.com", "123456"));

        assertEquals("GOOGLE_AUTH_REQUIRED", ex.getErrorCode());
        assertEquals("inactive", unlinked.getStatus());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(jwtService);
    }

    /** Kiểm thử P0-09: verifyGoogleOtp từ chối tài khoản đã active để chặn đăng nhập không mật khẩu. */
    @Test
    void verifyGoogleOtpRejectsAlreadyActiveAccount() {
        User active = pendingGoogleMember(44L, "active44", "active44@gmail.com", "google-sub-44");
        active.setStatus("active");
        when(otpService.verifyOtp("active44@gmail.com", "123456", OtpPurpose.GOOGLE_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("active44@gmail.com")).thenReturn(Optional.of(active));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.verifyGoogleOtp("active44@gmail.com", "123456"));

        assertEquals("ACCOUNT_NOT_PENDING", ex.getErrorCode());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(jwtService);
    }

    /** Kiểm thử: xác thực OTP Google từ chối tài khoản bị khóa và không kích hoạt lại. */
    @Test
    void verifyGoogleOtpRejectsLockedAccountWithoutReactivatingIt() {
        User locked = pendingUser();
        locked.setStatus("locked");
        when(otpService.verifyOtp("locked@gmail.com", "123456", OtpPurpose.GOOGLE_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("locked@gmail.com")).thenReturn(Optional.of(locked));

        assertThrows(ForbiddenException.class, () -> service.verifyGoogleOtp("locked@gmail.com", "123456"));
        assertEquals("locked", locked.getStatus());
        verify(userRepository, never()).save(any());
    }

    /** Kiểm thử: gửi OTP Google để SMTP chạy sau commit và vô hiệu OTP nếu gửi thất bại. */
    @Test
    void requestGoogleOtpDefersSmtpDeliveryUntilAfterCommitAndInvalidatesOnFailure() {
        User pendingGoogle = pendingGoogleMember(55L, "slow", "slow@gmail.com", "google-sub-55");
        when(userRepository.findByEmailIgnoreCase("slow@gmail.com")).thenReturn(Optional.of(pendingGoogle));
        when(otpService.generateOtp("slow@gmail.com", OtpPurpose.GOOGLE_ACTIVATION)).thenReturn("654321");
        org.mockito.Mockito.doThrow(new RuntimeException("SMTP timeout"))
                .when(otpDeliveryPort).send("slow@gmail.com", "654321");

        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            String code = service.requestGoogleOtp("slow@gmail.com");
            assertEquals("654321", code);
            verify(otpDeliveryPort, never()).send(any(), any());

            var syncs = org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations();
            var failure = assertThrows(
                    com.swp391.scms.common.exception.ServiceUnavailableException.class,
                    () -> syncs.forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit));
            assertEquals("OTP_DELIVERY_FAILED", failure.getErrorCode());
            verify(otpDeliveryPort).send("slow@gmail.com", "654321");
            verify(otpService).invalidate("slow@gmail.com");
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /** Kiểm thử: yêu cầu OTP đặt lại mật khẩu gửi mã mục đích PASSWORD_RESET cho người dùng đang hoạt động. */
    @Test
    void requestPasswordResetOtpSendsCodeToActiveUser() {
        User active = pendingUser();
        active.setStatus("active");
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(active));
        when(otpService.generateOtp("a@b.com", OtpPurpose.PASSWORD_RESET)).thenReturn("246810");

        String code = service.requestPasswordResetOtp("A@b.com");

        assertEquals("246810", code);
        verify(otpDeliveryPort).send("a@b.com", "246810");
    }

    /** Kiểm thử: đặt lại mật khẩu bằng OTP cập nhật mật khẩu đã mã hóa và kích hoạt tài khoản. */
    @Test
    void resetPasswordWithOtpUpdatesEncodedPasswordAndActivatesAccount() {
        User user = pendingUser();
        user.setId(77L);
        user.setStatus("active");
        when(otpService.verifyOtp("a@b.com", "246810", OtpPurpose.PASSWORD_RESET))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("a@b.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPass123!")).thenReturn("encoded-new-pass");

        service.resetPasswordWithOtp(new ResetPasswordRequest("A@b.com", "246810", "NewPass123!"));

        assertEquals("encoded-new-pass", user.getPasswordHash());
        verify(userRepository).save(user);
    }

    /**
     * Kiểm thử P0-09 đầu-cuối với OtpService thật: mã OTP của luồng này không bao giờ được chấp nhận bởi luồng
     * khác (ACCOUNT_ACTIVATION <-> PASSWORD_RESET <-> GOOGLE_ACTIVATION).
     */
    @Test
    void crossFlowOtpCannotBeReusedAcrossActivationPasswordResetAndGoogleFlows() {
        OtpChallengeRepository otpRepo = mock(OtpChallengeRepository.class);
        AtomicReference<OtpChallenge> stored = new AtomicReference<>();
        when(otpRepo.findByTargetForUpdate("victim@gmail.com")).thenAnswer(inv -> Optional.ofNullable(stored.get()));
        when(otpRepo.save(any(OtpChallenge.class))).thenAnswer(inv -> {
            OtpChallenge c = inv.getArgument(0);
            stored.set(c);
            return c;
        });
        org.mockito.Mockito.doAnswer(inv -> {
            stored.set(null);
            return null;
        }).when(otpRepo).delete(any(OtpChallenge.class));

        Clock fixedClock = Clock.fixed(Instant.parse("2026-10-01T00:00:00Z"), ZoneOffset.UTC);
        OtpService realOtpService = new OtpService(otpRepo, new BCryptPasswordEncoder(), fixedClock);
        AuthService authWithRealOtp = new AuthService(
                userRepository, roleRepository, passwordEncoder, jwtService,
                realOtpService, otpDeliveryPort, fixedClock, true);

        User user = pendingGoogleMember(99L, "victim", "victim@gmail.com", "sub-99");
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("victim@gmail.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmailIgnoreCase("victim@gmail.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPass123!")).thenReturn("new-hash");
        when(jwtService.generateToken(99L, "victim", "MEMBER")).thenReturn("jwt-99");

        // 1. ACCOUNT_ACTIVATION OTP bị từ chối ở resetPasswordWithOtp và verifyGoogleOtp, nhưng hợp lệ ở verifyOtp
        String activationCode = authWithRealOtp.generateOtp("victim@gmail.com");
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.resetPasswordWithOtp(new ResetPasswordRequest("victim@gmail.com", activationCode, "NewPass123!")));
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.verifyGoogleOtp("victim@gmail.com", activationCode));
        assertEquals(OtpService.VerifyResult.SUCCESS,
                authWithRealOtp.verifyOtp(new VerifyOtpRequest("victim@gmail.com", activationCode)).result());

        // 2. GOOGLE_ACTIVATION OTP bị từ chối ở resetPasswordWithOtp và verifyOtp, nhưng hợp lệ ở verifyGoogleOtp
        user.setStatus("inactive");
        String googleCode = authWithRealOtp.requestGoogleOtp("victim@gmail.com");
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.resetPasswordWithOtp(new ResetPasswordRequest("victim@gmail.com", googleCode, "NewPass123!")));
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.verifyOtp(new VerifyOtpRequest("victim@gmail.com", googleCode)));
        assertEquals("jwt-99", authWithRealOtp.verifyGoogleOtp("victim@gmail.com", googleCode).token());

        // 3. PASSWORD_RESET OTP bị từ chối ở verifyOtp và verifyGoogleOtp, nhưng hợp lệ ở resetPasswordWithOtp
        user.setStatus("inactive");
        String resetCode = authWithRealOtp.requestPasswordResetOtp("victim@gmail.com");
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.verifyOtp(new VerifyOtpRequest("victim@gmail.com", resetCode)));
        assertThrows(BadRequestException.class,
                () -> authWithRealOtp.verifyGoogleOtp("victim@gmail.com", resetCode));
        authWithRealOtp.resetPasswordWithOtp(new ResetPasswordRequest("victim@gmail.com", resetCode, "NewPass123!"));
        assertEquals("new-hash", user.getPasswordHash());
    }

    /** Kiểm thử P1-BE-02: ba điểm vào xác thực OTP không gắn @Transactional bên ngoài để tránh lồng kết nối pool với REQUIRES_NEW. */
    @Test
    void otpVerificationMethodsDoNotHoldOuterTransactionalAnnotation() throws Exception {
        assertNull(AuthService.class.getAnnotation(Transactional.class));
        Method verifyOtpMethod = AuthService.class.getMethod("verifyOtp", VerifyOtpRequest.class);
        Method resetPasswordMethod = AuthService.class.getMethod("resetPasswordWithOtp", ResetPasswordRequest.class);
        Method verifyGoogleOtpMethod = AuthService.class.getMethod("verifyGoogleOtp", String.class, String.class);

        assertFalse(verifyOtpMethod.isAnnotationPresent(Transactional.class));
        assertFalse(resetPasswordMethod.isAnnotationPresent(Transactional.class));
        assertFalse(verifyGoogleOtpMethod.isAnnotationPresent(Transactional.class));
    }

    /** Kiểm thử P1-BE-02: otpService.verifyOtp hoàn tất trước khi transaction cập nhật User bắt đầu (không lồng kết nối HikariCP). */
    @Test
    void otpVerificationRunsStrictlyBeforeWriteTransactionStarts() {
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        TransactionStatus txStatus = new SimpleTransactionStatus();
        when(txManager.getTransaction(any())).thenReturn(txStatus);

        AuthService txService = new AuthService(
                userRepository, roleRepository, passwordEncoder, jwtService,
                otpService, otpDeliveryPort, Clock.systemUTC(), false,
                null, null, null, null, txManager);

        User user = pendingGoogleMember(70L, "member70", "m70@gmail.com", "sub-70");
        when(otpService.verifyOtp("m70@gmail.com", "111222", OtpPurpose.ACCOUNT_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("m70@gmail.com")).thenReturn(Optional.of(user));

        txService.verifyOtp(new VerifyOtpRequest("m70@gmail.com", "111222"));

        InOrder order = inOrder(otpService, txManager, userRepository);
        order.verify(otpService).verifyOtp("m70@gmail.com", "111222", OtpPurpose.ACCOUNT_ACTIVATION);
        order.verify(txManager).getTransaction(any());
        order.verify(userRepository).save(user);
        order.verify(txManager).commit(txStatus);

        // Kiểm chứng tương tự cho resetPasswordWithOtp
        user.setStatus("inactive");
        when(otpService.verifyOtp("m70@gmail.com", "333444", OtpPurpose.PASSWORD_RESET))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(passwordEncoder.encode("NewPass123!")).thenReturn("encoded-70");
        txService.resetPasswordWithOtp(new ResetPasswordRequest("m70@gmail.com", "333444", "NewPass123!"));
        order.verify(otpService).verifyOtp("m70@gmail.com", "333444", OtpPurpose.PASSWORD_RESET);
        order.verify(txManager).getTransaction(any());
        order.verify(userRepository).save(user);
        order.verify(txManager).commit(txStatus);

        // Kiểm chứng tương tự cho verifyGoogleOtp
        user.setStatus("inactive");
        when(otpService.verifyOtp("m70@gmail.com", "555666", OtpPurpose.GOOGLE_ACTIVATION))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.SUCCESS, 0));
        when(userRepository.findByEmailIgnoreCase("m70@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(70L, "member70", "MEMBER")).thenReturn("jwt-70");
        assertEquals("jwt-70", txService.verifyGoogleOtp("m70@gmail.com", "555666").token());
        order.verify(otpService).verifyOtp("m70@gmail.com", "555666", OtpPurpose.GOOGLE_ACTIVATION);
        order.verify(txManager).getTransaction(any());
        order.verify(userRepository).save(user);
        order.verify(txManager).commit(txStatus);

        // Nếu verifyOtp thất bại thì không mở transaction ghi nào cả.
        PlatformTransactionManager txManager2 = mock(PlatformTransactionManager.class);
        AuthService txService2 = new AuthService(
                userRepository, roleRepository, passwordEncoder, jwtService,
                otpService, otpDeliveryPort, Clock.systemUTC(), false,
                null, null, null, null, txManager2);
        when(otpService.verifyOtp("m70@gmail.com", "999999", OtpPurpose.PASSWORD_RESET))
                .thenReturn(new OtpService.Status(OtpService.VerifyResult.INVALID_CODE, 2));

        assertThrows(BadRequestException.class,
                () -> txService2.resetPasswordWithOtp(new ResetPasswordRequest("m70@gmail.com", "999999", "NewPass123!")));
        verifyNoInteractions(txManager2);
    }

    /** Kiểm thử P1-BE-01: đăng nhập định tuyến riêng truy vấn email (chứa @) và username (không chứa @), tránh trùng NonUniqueResultException. */
    @Test
    void loginRoutesEmailAndUsernameIdentifiersToSeparateQueries() {
        User emailUser = new User();
        emailUser.setId(20L);
        emailUser.setEmail("victim@gmail.com");
        emailUser.setUsername("victim");
        emailUser.setPasswordHash("hash-email");
        emailUser.setStatus("active");
        Role role = new Role();
        role.setCode("MEMBER");
        emailUser.setRole(role);

        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("victim@gmail.com")).thenReturn(Optional.of(emailUser));
        when(passwordEncoder.matches("Pass@123", "hash-email")).thenReturn(true);
        when(jwtService.generateToken(20L, "victim", "MEMBER")).thenReturn("jwt-email");

        var emailRes = service.login(new LoginRequest("Victim@Gmail.com", "Pass@123"));
        assertEquals("jwt-email", emailRes.token());
        verify(userRepository).findByEmailIgnoreCaseAndDeletedAtIsNull("victim@gmail.com");
        verify(userRepository, never()).findByUsernameIgnoreCaseAndDeletedAtIsNull("victim@gmail.com");
        verify(userRepository, never()).findActiveByIdentifier(any());

        when(userRepository.findByUsernameIgnoreCaseAndDeletedAtIsNull("victim")).thenReturn(Optional.of(emailUser));
        var userRes = service.login(new LoginRequest("Victim", "Pass@123"));
        assertEquals("jwt-email", userRes.token());
        verify(userRepository).findByUsernameIgnoreCaseAndDeletedAtIsNull("victim");
        verify(userRepository, never()).findActiveByIdentifier(any());
    }

    /** Kiểm thử: đăng nhập sai 5 lần thì bị khóa 1 phút. */
    @Test
    void loginLocksAfterFiveFailedAttemptsForOneMinute() {
        User user = new User();
        user.setId(10L);
        user.setUsername("testmember");
        user.setPasswordHash("hashed_real_password");
        user.setStatus("active");
        Role role = new Role();
        role.setCode("MEMBER");
        user.setRole(role);

        when(userRepository.findByUsernameIgnoreCaseAndDeletedAtIsNull("testmember")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_pwd", "hashed_real_password")).thenReturn(false);
        when(passwordEncoder.matches("correct_pwd", "hashed_real_password")).thenReturn(true);
        when(jwtService.generateToken(any(), any(), any())).thenReturn("mock_token");

        // 4 lần thất bại đầu: ném UnauthorizedException với số lượt còn lại giảm dần
        for (int i = 1; i <= 4; i++) {
            UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                    () -> service.login(new LoginRequest("testmember", "wrong_pwd")));
            assertEquals("INVALID_CREDENTIALS", ex.getErrorCode());
        }

        // Lần thất bại thứ 5: ném TooManyRequestsException (LOGIN_LOCKED)
        TooManyRequestsException lockEx = assertThrows(TooManyRequestsException.class,
                () -> service.login(new LoginRequest("testmember", "wrong_pwd")));
        assertEquals("LOGIN_LOCKED", lockEx.getErrorCode());

        // Lần thử thứ 6 dù đúng mật khẩu vẫn bị chặn trong thời gian bị khóa
        TooManyRequestsException stillLocked = assertThrows(TooManyRequestsException.class,
                () -> service.login(new LoginRequest("testmember", "correct_pwd")));
        assertEquals("LOGIN_LOCKED", stillLocked.getErrorCode());

        // Đặt lại bộ đếm và đăng nhập bằng mật khẩu đúng thì thành công
        service.getLoginAttemptService().reset("testmember");
        var tokenResponse = service.login(new LoginRequest("testmember", "correct_pwd"));
        assertNotNull(tokenResponse);
        assertEquals("mock_token", tokenResponse.token());
    }
}
