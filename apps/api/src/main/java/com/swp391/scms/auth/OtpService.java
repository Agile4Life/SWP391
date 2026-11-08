package com.swp391.scms.auth;

import com.swp391.scms.auth.entity.OtpChallenge;
import com.swp391.scms.auth.repository.OtpChallengeRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class OtpService {
    private static final int MAX_ATTEMPTS = 3;
    private static final SecureRandom RANDOM = new SecureRandom();

    public enum VerifyResult { SUCCESS, EXPIRED_OR_NOT_FOUND, INVALID_CODE, MAX_ATTEMPTS_EXCEEDED }
    public record Status(VerifyResult result, int remainingAttempts) {}

    private final OtpChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public OtpService(OtpChallengeRepository challengeRepository, PasswordEncoder passwordEncoder, Clock clock) {
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Transactional
    public String generateOtp(String target) {
        String normalizedTarget = normalize(target);
        LocalDateTime now = LocalDateTime.now(clock);
        challengeRepository.deleteByExpiresAtBefore(now);
        challengeRepository.deleteByTargetIgnoreCase(normalizedTarget);

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        challengeRepository.save(new OtpChallenge(normalizedTarget, passwordEncoder.encode(code), now.plusMinutes(5), now));
        return code;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void invalidate(String target) {
        challengeRepository.deleteByTargetIgnoreCase(normalize(target));
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public Status verifyOtp(String target, String code) {
        String normalizedTarget = normalize(target);
        OtpChallenge challenge = challengeRepository.findByTargetForUpdate(normalizedTarget).orElse(null);
        LocalDateTime now = LocalDateTime.now(clock);
        if (challenge == null || now.isAfter(challenge.getExpiresAt())) {
            challengeRepository.deleteByTargetIgnoreCase(normalizedTarget);
            return new Status(VerifyResult.EXPIRED_OR_NOT_FOUND, 0);
        }
        if (challenge.getFailedAttempts() >= MAX_ATTEMPTS) {
            challengeRepository.deleteByTargetIgnoreCase(normalizedTarget);
            return new Status(VerifyResult.MAX_ATTEMPTS_EXCEEDED, 0);
        }
        if (!passwordEncoder.matches(code, challenge.getCodeHash())) {
            int attempts = challenge.getFailedAttempts() + 1;
            if (attempts >= MAX_ATTEMPTS) {
                challengeRepository.delete(challenge);
                return new Status(VerifyResult.MAX_ATTEMPTS_EXCEEDED, 0);
            }
            challenge.setFailedAttempts(attempts);
            challengeRepository.saveAndFlush(challenge);
            return new Status(VerifyResult.INVALID_CODE, MAX_ATTEMPTS - attempts);
        }
        challengeRepository.delete(challenge);
        return new Status(VerifyResult.SUCCESS, 0);
    }

    private String normalize(String target) {
        return target.trim().toLowerCase(Locale.ROOT);
    }
}