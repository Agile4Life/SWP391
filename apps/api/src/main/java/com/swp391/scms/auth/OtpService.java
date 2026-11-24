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

/**
 * Quản lý mã OTP: sinh mã 6 số, lưu dạng băm BCrypt (không lưu mã gốc), hạn 5 phút, sai tối đa 3 lần thì hủy
 * mã.
 */
@Service
public class OtpService {
    private static final int MAX_ATTEMPTS = 3;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Kết quả kiểm tra OTP: đúng, hết hạn/không có, sai mã, hoặc sai quá số lần. */
    public enum VerifyResult { SUCCESS, EXPIRED_OR_NOT_FOUND, INVALID_CODE, MAX_ATTEMPTS_EXCEEDED }
    /** Kết quả kiểm tra kèm số lần còn được thử. */
    public record Status(VerifyResult result, int remainingAttempts) {}

    private final OtpChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    /** Nhận repository lưu OTP, PasswordEncoder để băm mã và Clock. */
    public OtpService(OtpChallengeRepository challengeRepository, PasswordEncoder passwordEncoder, Clock clock) {
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /**
     * Sinh mã OTP mới cho địa chỉ đích: xóa mã hết hạn và mã cũ của địa chỉ này, sinh 6 số ngẫu nhiên an toàn,
     * lưu bản băm với hạn 5 phút, trả mã gốc để gửi đi.
     */
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

    /**
     * Hủy mã OTP của địa chỉ đích (dùng khi gửi email thất bại). Chạy transaction riêng để vẫn hủy được dù
     * transaction ngoài rollback.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void invalidate(String target) {
        challengeRepository.deleteByTargetIgnoreCase(normalize(target));
    }

    /**
     * Kiểm tra mã OTP với khóa dòng để hai request song song không cùng thử. Hết hạn hoặc không có thì xóa và
     * báo hết hạn; sai đủ 3 lần thì xóa mã; sai thì tăng đếm và báo số lần còn lại; đúng thì xóa mã (mỗi mã
     * dùng một lần). Chạy transaction riêng để số lần sai được lưu dù transaction ngoài lỗi.
     */
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

    /** Chuẩn hóa địa chỉ đích: bỏ khoảng trắng hai đầu và chuyển chữ thường. */
    private String normalize(String target) {
        return target.trim().toLowerCase(Locale.ROOT);
    }
}