package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.auth.dto.GoogleLoginRequest;
import com.swp391.scms.auth.dto.GoogleUserInfo;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.UnauthorizedException;
import com.swp391.scms.security.JwtService;
import com.swp391.scms.users.RoleRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.util.Optional;

@ExtendWith(MockitoExtension.class)
class GoogleAuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock OtpService otpService;
    @Mock OtpDeliveryPort otpDeliveryPort;
    @Mock GoogleTokenVerifierPort googleTokenVerifierPort;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                roleRepository,
                passwordEncoder,
                jwtService,
                otpService,
                otpDeliveryPort,
                Clock.systemUTC(),
                false,
                null,
                googleTokenVerifierPort
        );
    }

    private Role createRole(String code) {
        Role role = new Role();
        role.setCode(code);
        role.setName(code);
        return role;
    }

    @Test
    void rejectsReplacingExistingGoogleIdentity() {
        var existing = new User();
        existing.setGoogleSub("original-sub");
        when(googleTokenVerifierPort.verify("token")).thenReturn(
                new GoogleUserInfo("different-sub", "member@gmail.com", true, "Member", null));
        when(userRepository.findByEmailIgnoreCase("member@gmail.com")).thenReturn(Optional.of(existing));
        assertThrows(UnauthorizedException.class, () -> authService.loginWithGoogle(new GoogleLoginRequest("token")));
        assertEquals("original-sub", existing.getGoogleSub());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(jwtService);
    }

    @Test
    void requiresAdditionalVerificationToLinkThirdPartyEmail() {
        var existing = new User();
        when(googleTokenVerifierPort.verify("token")).thenReturn(
                new GoogleUserInfo("new-sub", "member@example.com", true, "Member", null));
        when(userRepository.findByEmailIgnoreCase("member@example.com")).thenReturn(Optional.of(existing));
        assertThrows(UnauthorizedException.class, () -> authService.loginWithGoogle(new GoogleLoginRequest("token")));
        assertNull(existing.getGoogleSub());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(jwtService);
    }

    @Test
    @DisplayName("Case 1: Token hợp lệ - Người dùng mới -> Tự tạo tài khoản MEMBER active và cấp JWT")
    void testGoogleLogin_ValidToken_NewUser() {
        GoogleUserInfo googleUser = new GoogleUserInfo(
                "sub-12345",
                "newuser@gmail.com",
                true,
                "New Google User",
                "https://avatar.com/pic.jpg"
        );
        when(googleTokenVerifierPort.verify("valid-id-token")).thenReturn(googleUser);
        when(userRepository.findByGoogleSub("sub-12345")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("newuser@gmail.com")).thenReturn(Optional.empty());
        when(roleRepository.findByCodeIgnoreCase("MEMBER")).thenReturn(Optional.of(createRole("MEMBER")));
        when(userRepository.findByUsernameIgnoreCase(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any())).thenReturn("hashed-pwd");
        when(userRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(99L);
            return u;
        });
        when(jwtService.generateToken(any(), any(), eq("MEMBER"))).thenReturn("jwt-token-xyz");

        AuthTokenResponse response = authService.loginWithGoogle(new GoogleLoginRequest("valid-id-token"));

        assertNotNull(response);
        assertEquals("jwt-token-xyz", response.token());
        assertEquals("MEMBER", response.role());
        verify(userRepository, atLeastOnce()).save(any(User.class));
    }

    @Test
    @DisplayName("Case 2: Token hợp lệ - Email đã tồn tại vai trò MEMBER -> Đăng nhập và liên kết google_sub")
    void testGoogleLogin_ValidToken_ExistingUser() {
        GoogleUserInfo googleUser = new GoogleUserInfo(
                "sub-67890",
                "member@gmail.com",
                true,
                "Member Existing",
                null
        );
        when(googleTokenVerifierPort.verify("valid-token-existing")).thenReturn(googleUser);
        when(userRepository.findByGoogleSub("sub-67890")).thenReturn(Optional.empty());

        User existingUser = new User();
        existingUser.setId(10L);
        existingUser.setEmail("member@gmail.com");
        existingUser.setUsername("existing_member");
        existingUser.setStatus("active");
        existingUser.setRole(createRole("MEMBER"));

        when(userRepository.findByEmailIgnoreCase("member@gmail.com")).thenReturn(Optional.of(existingUser));
        when(jwtService.generateToken(10L, "existing_member", "MEMBER")).thenReturn("jwt-existing");

        AuthTokenResponse response = authService.loginWithGoogle(new GoogleLoginRequest("valid-token-existing"));

        assertNotNull(response);
        assertEquals("jwt-existing", response.token());
        assertEquals("MEMBER", response.role());
        assertEquals("sub-67890", existingUser.getGoogleSub());
        verify(userRepository).save(existingUser);
    }

    @Test
    @DisplayName("Case 3: Token sai / Chữ ký không hợp lệ / Hết hạn -> Ném lỗi UnauthorizedException (401)")
    void testGoogleLogin_InvalidToken() {
        when(googleTokenVerifierPort.verify("invalid-token"))
                .thenThrow(new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Invalid"));

        assertThrows(UnauthorizedException.class,
                () -> authService.loginWithGoogle(new GoogleLoginRequest("invalid-token")));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Case 4: Email chưa được Google xác minh (email_verified = false) -> Ném lỗi UnauthorizedException (401)")
    void testGoogleLogin_EmailNotVerified() {
        GoogleUserInfo unverifiedUser = new GoogleUserInfo(
                "sub-unverified",
                "unverified@gmail.com",
                false, // not verified
                "Unverified User",
                null
        );
        when(googleTokenVerifierPort.verify("token-unverified")).thenReturn(unverifiedUser);

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> authService.loginWithGoogle(new GoogleLoginRequest("token-unverified")));
        assertEquals("GOOGLE_EMAIL_NOT_VERIFIED", ex.getErrorCode());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Case 5: Tài khoản nhân sự (COACH/RECEPTIONIST/STAFF/MANAGER) -> Ném lỗi ForbiddenException (403)")
    void testGoogleLogin_StaffNotAllowed() {
        GoogleUserInfo coachGoogleUser = new GoogleUserInfo(
                "sub-coach",
                "coach@center.com",
                true,
                "Head Coach",
                null
        );
        when(googleTokenVerifierPort.verify("coach-token")).thenReturn(coachGoogleUser);

        User coachUser = new User();
        coachUser.setId(20L);
        coachUser.setEmail("coach@center.com");
        coachUser.setUsername("head_coach");
        coachUser.setStatus("active");
        coachUser.setRole(createRole("COACH")); // Role COACH

        when(userRepository.findByGoogleSub("sub-coach")).thenReturn(Optional.of(coachUser));

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> authService.loginWithGoogle(new GoogleLoginRequest("coach-token")));
        assertEquals("STAFF_GOOGLE_NOT_ALLOWED", ex.getErrorCode());
        verify(jwtService, never()).generateToken(any(), any(), any());
    }

    @Test
    @DisplayName("Case 6: Tài khoản bị khóa (locked hoặc inactive) -> Ném lỗi ForbiddenException (403)")
    void testGoogleLogin_LockedAccount() {
        GoogleUserInfo googleUser = new GoogleUserInfo(
                "sub-locked",
                "locked@gmail.com",
                true,
                "Locked User",
                null
        );
        when(googleTokenVerifierPort.verify("locked-token")).thenReturn(googleUser);

        User lockedUser = new User();
        lockedUser.setId(30L);
        lockedUser.setEmail("locked@gmail.com");
        lockedUser.setUsername("locked_member");
        lockedUser.setStatus("locked"); // Locked status!
        lockedUser.setRole(createRole("MEMBER"));

        when(userRepository.findByGoogleSub("sub-locked")).thenReturn(Optional.of(lockedUser));

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> authService.loginWithGoogle(new GoogleLoginRequest("locked-token")));
        assertEquals("ACCOUNT_INACTIVE", ex.getErrorCode());
        verify(jwtService, never()).generateToken(any(), any(), any());
    }
}
