package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.auth.entity.OtpChallenge;
import com.swp391.scms.auth.repository.OtpChallengeRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    @BeforeEach
    void setUp() {
        service = new OtpService(repository, encoder, CLOCK);
    }

    private OtpChallenge challenge(LocalDateTime expiresAt, int failedAttempts) {
        OtpChallenge c = new OtpChallenge("a@b.com", encoder.encode("123456"), expiresAt, NOW);
        c.setFailedAttempts(failedAttempts);
        return c;
    }

    @Test
    void generateOtpReturnsSixDigitCodeAndStoresHash() {
        String code = service.generateOtp(" A@B.com ");

        assertEquals(6, code.length());
        verify(repository).deleteByTargetIgnoreCase("a@b.com");
        verify(repository).save(any(OtpChallenge.class));
    }

    @Test
    void verifySucceedsWithCorrectCodeAndConsumesChallenge() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 0);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        assertEquals(OtpService.VerifyResult.SUCCESS, service.verifyOtp("a@b.com", "123456").result());
        verify(repository).delete(c);
    }

    @Test
    void verifyReportsExpiredCode() {
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(challenge(NOW.minusSeconds(1), 0)));

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, service.verifyOtp("a@b.com", "123456").result());
    }

    @Test
    void verifyReportsMissingChallenge() {
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.empty());

        assertEquals(OtpService.VerifyResult.EXPIRED_OR_NOT_FOUND, service.verifyOtp("a@b.com", "123456").result());
    }

    @Test
    void wrongCodeDecrementsRemainingAttempts() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 0);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        OtpService.Status status = service.verifyOtp("a@b.com", "000000");

        assertEquals(OtpService.VerifyResult.INVALID_CODE, status.result());
        assertEquals(2, status.remainingAttempts());
        assertEquals(1, c.getFailedAttempts());
    }

    @Test
    void thirdWrongCodeLocksOut() {
        OtpChallenge c = challenge(NOW.plusMinutes(5), 2);
        when(repository.findByTargetForUpdate("a@b.com")).thenReturn(Optional.of(c));

        assertEquals(OtpService.VerifyResult.MAX_ATTEMPTS_EXCEEDED, service.verifyOtp("a@b.com", "000000").result());
        verify(repository).delete(c);
    }
}