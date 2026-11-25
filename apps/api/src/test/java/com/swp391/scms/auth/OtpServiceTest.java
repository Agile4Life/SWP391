package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.auth.entity.OtpChallenge;
import com.swp391.scms.auth.repository.OtpChallengeRepository;
import com.swp391.scms.common.exception.TooManyRequestsException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Bộ kiểm thử cho service OtpService (otp service). */
@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-01T00:00:00Z"), ZoneOffset.UTC);
    private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);

    @Mock OtpChallengeRepository repository;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private OtpService service;

    /** Chuẩn bị trước mỗi test: tạo OtpService với đồng hồ và repository giả. */
    @BeforeEach
    void setUp() {
        service = new OtpService(repository, encoder, CLOCK);
    }

    /** Hàm trợ giúp của test: tạo thử thách OTP mẫu. */
    private OtpChallenge challenge(LocalDateTime expiresAt, int failedAttempts) {
        return challenge(expiresAt, failedAttempts, OtpPurpose.ACCOUNT_ACTIVATION, NOW);
    }

    /** Hàm trợ giúp của test: tạo thử thách OTP mẫu với mục đích và thời điểm tạo chỉ định. */
    private OtpChallenge challenge(LocalDateTime expiresAt, int failedAttempts, OtpPurpose purpose, LocalDateTime createdAt) {
        OtpChallenge c = new OtpChallenge("a@b.com", encoder.encode("123456"), expiresAt, createdAt, purpose);
        c.setFailedAttempts(failedAttempts);
        return c;
    }

    /** Kiểm thử: sinh OTP khóa dòng đích, trả mã 6 chữ số và lưu bản băm kèm mục đích. */
    @Test
    void generateOtpReturnsSixDigitCodeAndStoresHashWithPurpose() {
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.empty());

        String code = service.generateOtp(" A@B.com ", OtpPurpose.PASSWORD_RESET);

        assertEquals(6, code.length());
        verify(repository).findByTargetForUpdate("a@b.com");
        ArgumentCaptor<OtpChallenge> captor = ArgumentCaptor.forClass(OtpChallenge.class);
        verify(repository).save(captor.capture());
        assertEquals("a@b.com", captor.getValue().getTarget());
        assertEquals(OtpPurpose.PASSWORD_RESET, captor.getValue().getPurpose());
        assertTrue(encoder.matches(code, captor.getValue().getCodeHash()));
    }

    /** Kiểm thử: gửi lại OTP trong thời gian cooldown bị từ chối với HTTP 429 và không ghi đè mã cũ. */
    @Test
    void generateOtpRejectsResendWithinCooldownAndKeepsExistingChallenge() {
        OtpChallenge existing = challenge(NOW.plusMinutes(5), 0, OtpPurpose.ACCOUNT_ACTIVATION, NOW.minusSeconds(10));
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(existing));

        TooManyRequestsException ex = assertThrows(
                TooManyRequestsException.class,
                () -> service.generateOtp("a@b.com", OtpPurpose.ACCOUNT_ACTIVATION));

        assertEquals("OTP_RESEND_COOLDOWN", ex.getErrorCode());
        verify(repository, never()).save(any());
        verify(repository, never()).saveAndFlush(any());
        verify(repository, never()).deleteByTargetIgnoreCase(any());
    }

    /** Kiểm thử: gửi lại OTP sau khi hết cooldown làm mới bản ghi tại chỗ (giữ khóa FOR UPDATE) và đặt lại số lần sai. */
    @Test
    void generateOtpAfterCooldownRefreshesExistingChallengeInPlace() {
        OtpChallenge existing = challenge(NOW.plusMinutes(4), 2, OtpPurpose.ACCOUNT_ACTIVATION,
                NOW.minusSeconds(OtpService.DEFAULT_RESEND_COOLDOWN_SECONDS));
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(existing));

        String newCode = service.generateOtp("a@b.com", OtpPurpose.PASSWORD_RESET);

        assertEquals(6, newCode.length());
        assertEquals(0, existing.getFailedAttempts());
        assertEquals(OtpPurpose.PASSWORD_RESET, existing.getPurpose());
        assertEquals(NOW, existing.getCreatedAt());
        assertEquals(NOW.plusMinutes(5), existing.getExpiresAt());
        assertTrue(encoder.matches(newCode, existing.getCodeHash()));
        verify(repository).saveAndFlush(existing);
        verify(repository, never()).deleteByTargetIgnoreCase(any());
    }

    /** Kiểm thử: mã OTP cũ đã hết hạn được phép làm mới ngay kể cả khi thời gian tạo gần. */
    @Test
    void generateOtpAllowsResendWhenExistingChallengeIsExpired() {
        OtpChallenge expired = challenge(NOW.minusSeconds(1), 0, OtpPurpose.ACCOUNT_ACTIVATION, NOW.minusSeconds(5));
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(expired));

        String newCode = service.generateOtp("a@b.com", OtpPurpose.GOOGLE_ACTIVATION);

        assertEquals(6, newCode.length());
        assertEquals(OtpPurpose.GOOGLE_ACTIVATION, expired.getPurpose());
        verify(repository).saveAndFlush(expired);
    }

    /** Kiểm thử: nhập đúng mã và đúng mục đích thì xác thực thành công và tiêu thụ thử thách. */
    @Test
    void verifySucceedsWithCorrectCodeAndConsumesChallenge() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 0);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        assertEquals(OtpService.VerifyResult.SUCCESS, service.verifyOtp("a@b.com", "123456").result());
        verify(repository).delete(c);
    }

    /** Kiểm thử: mã OTP của một luồng bị từ chối khi xác thực ở luồng khác và không xóa mã hợp lệ đang chờ. */
    @ParameterizedTest
    @CsvSource({
            "ACCOUNT_ACTIVATION,PASSWORD_RESET",
            "ACCOUNT_ACTIVATION,GOOGLE_ACTIVATION",
            "GOOGLE_ACTIVATION,PASSWORD_RESET",
            "GOOGLE_ACTIVATION,ACCOUNT_ACTIVATION",
            "PASSWORD_RESET,ACCOUNT_ACTIVATION",
            "PASSWORD_RESET,GOOGLE_ACTIVATION"
    })
    void verifyRejectsMismatchedPurposeWithoutDeletingActiveChallenge(OtpPurpose storedPurpose, OtpPurpose expectedPurpose) {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 0, storedPurpose, NOW);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        OtpService.Status status = service.verifyOtp("a@b.com", "123456", expectedPurpose);

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, status.result());
        verify(repository, never()).delete(any());
        verify(repository, never()).deleteByTargetIgnoreCase(any());
    }

    /** Kiểm thử: bản ghi OTP cũ không có mục đích (purpose = null) bị từ chối và dọn bỏ để tránh dùng chéo luồng. */
    @Test
    void verifyRejectsAndDeletesLegacyChallengeWithoutPurpose() {
        OtpChallenge legacy = challenge(NOW.plusMinutes(5), 0, OtpPurpose.ACCOUNT_ACTIVATION, NOW);
        legacy.setPurpose(null);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(legacy));

        OtpService.Status status = service.verifyOtp("a@b.com", "123456", OtpPurpose.PASSWORD_RESET);

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, status.result());
        verify(repository).delete(legacy);
    }

    /** Kiểm thử: báo mã OTP hết hạn. */
    @Test
    void verifyReportsExpiredCode() {
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(challenge(NOW.minusSeconds(1), 0)));

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, service.verifyOtp("a@b.com", "123456").result());
    }

    /** Kiểm thử: báo thiếu thử thách OTP. */
    @Test
    void verifyReportsMissingChallenge() {
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.empty());

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, service.verifyOtp("a@b.com", "123456").result());
    }

    /** Kiểm thử: nhập sai làm giảm số lần thử còn lại. */
    @Test
    void wrongCodeDecrementsRemainingAttempts() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 0);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        OtpService.Status status = service.verifyOtp("a@b.com", "000000");

        assertEquals(OtpService.VerifyResult.INVALID_CODE, status.result());
        assertEquals(2, status.remainingAttempts());
        assertEquals(1, c.getFailedAttempts());
    }

    /** Kiểm thử: nhập sai lần thứ ba thì khóa. */
    @Test
    void thirdWrongCodeLocksOut() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 2);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        assertEquals(OtpService.VerifyResult.MAX_ATTEMPTS_EXCEEDED, service.verifyOtp("a@b.com", "000000").result());
        verify(repository).delete(c);
    }
}
