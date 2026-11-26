package com.swp391.scms.auth;

import com.swp391.scms.auth.entity.OtpChallenge;
import com.swp391.scms.auth.repository.OtpChallengeRepository;
import com.swp391.scms.common.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

/**
 * Quản lý mã OTP: sinh mã 6 số gắn chặt với mục đích (purpose), lưu dạng băm BCrypt (không lưu mã gốc),
 * khóa dòng khi sinh/xác thực để tránh xung đột đồng thời, giới hạn tần suất gửi lại theo địa chỉ đích,
 * hạn 5 phút, sai tối đa 3 lần thì hủy mã.
 */
@Service
public class OtpService {
    private static final int MAX_ATTEMPTS = 3;
    /** Thời gian chờ mặc định giữa hai lần gửi mã OTP cho cùng một địa chỉ đích (khớp đồng hồ 30 giây ở UI). */
    public static final long DEFAULT_RESEND_COOLDOWN_SECONDS = 30L;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Kết quả kiểm tra OTP: đúng, hết hạn/không có/sai mục đích, sai mã, hoặc sai quá số lần. */
    public enum VerifyResult { SUCCESS, EXPIRED_OR_NOT_FOUND, INVALID_CODE, MAX_ATTEMPTS_EXCEEDED }
    /** Kết quả kiểm tra kèm số lần còn được thử. */
    public record Status(VerifyResult result, int remainingAttempts) {}

    private final OtpChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final long resendCooldownSeconds;

    /** Constructor cho test với thời gian chờ gửi lại mặc định. */
    public OtpService(OtpChallengeRepository challengeRepository, PasswordEncoder passwordEncoder, Clock clock) {
        this(challengeRepository, passwordEncoder, clock, DEFAULT_RESEND_COOLDOWN_SECONDS);
    }

    /** Nhận repository lưu OTP, PasswordEncoder để băm mã, Clock và cấu hình thời gian chờ gửi lại (giây). */
    @Autowired
    public OtpService(
            OtpChallengeRepository challengeRepository,
            PasswordEncoder passwordEncoder,
            Clock clock,
            @Value("${app.auth.otp-resend-cooldown-seconds:30}") long resendCooldownSeconds) {
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.resendCooldownSeconds = Math.max(0L, resendCooldownSeconds);
    }

    /** Sinh mã OTP mặc định cho luồng kích hoạt tài khoản. */
    @Transactional
    public String generateOtp(String target) {
        return generateOtp(target, OtpPurpose.ACCOUNT_ACTIVATION);
    }

    /**
     * Sinh mã OTP mới cho địa chỉ đích và mục đích cụ thể: khóa dòng hiện có (nếu có) bằng FOR UPDATE,
     * chặn gửi lại quá sớm trong thời gian cooldown, làm mới tại chỗ hoặc tạo mới bản ghi với bản băm BCrypt
     * có hạn 5 phút, rồi trả mã gốc để gửi đi.
     */
    @Transactional
    public String generateOtp(String target, OtpPurpose purpose) {
        String normalizedTarget = normalize(target);
        OtpPurpose effectivePurpose = purpose != null ? purpose : OtpPurpose.ACCOUNT_ACTIVATION;
        LocalDateTime now = LocalDateTime.now(clock);

        Optional<OtpChallenge> existingOpt = challengeRepository.findByTargetForUpdate(normalizedTarget);
        if (existingOpt.isPresent()) {
            OtpChallenge existing = existingOpt.get();
            LocalDateTime createdAt = existing.getCreatedAt();
            if (createdAt != null
                    && resendCooldownSeconds > 0
                    && !now.isAfter(existing.getExpiresAt())
                    && now.isBefore(createdAt.plusSeconds(resendCooldownSeconds))) {
                throw new TooManyRequestsException(
                        "OTP_RESEND_COOLDOWN",
                        "error.too_many_requests",
                        null,
                        "Too many OTP requests. Please wait before requesting a new code.");
            }
            String code = String.format("%06d", RANDOM.nextInt(1_000_000));
            existing.refresh(passwordEncoder.encode(code), now.plusMinutes(5), now, effectivePurpose);
            challengeRepository.saveAndFlush(existing);
            challengeRepository.deleteByExpiresAtBefore(now);
            return code;
        }

        challengeRepository.deleteByExpiresAtBefore(now);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        challengeRepository.save(new OtpChallenge(
                normalizedTarget,
                passwordEncoder.encode(code),
                now.plusMinutes(5),
                now,
                effectivePurpose));
        return code;
    }

    /**
     * Hủy mã OTP của địa chỉ đích (dùng khi gửi email thất bại). Chạy transaction riêng để vẫn hủy được dù
     * transaction ngoài rollback.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void invalidate(String target) {
        challengeRepository.deleteByTargetIgnoreCase(normalize(target));
    }

    /** Kiểm tra mã OTP cho luồng kích hoạt tài khoản mặc định. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Status verifyOtp(String target, String code) {
        return verifyOtp(target, code, OtpPurpose.ACCOUNT_ACTIVATION);
    }

    /**
     * Kiểm tra mã OTP với khóa dòng để hai request song song không cùng thử và đối chiếu chặt chẽ mục đích
     * (purpose). Hết hạn hoặc không có thì xóa và báo hết hạn; sai mục đích thì từ chối mà không xóa mã hợp lệ
     * của luồng khác; sai đủ 3 lần thì xóa mã; sai thì tăng đếm và báo số lần còn lại; đúng thì xóa mã (mỗi mã
     * dùng một lần). Chạy transaction riêng để số lần sai được lưu dù transaction ngoài lỗi.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Status verifyOtp(String target, String code, OtpPurpose expectedPurpose) {
        String normalizedTarget = normalize(target);
        OtpPurpose requiredPurpose = expectedPurpose != null ? expectedPurpose : OtpPurpose.ACCOUNT_ACTIVATION;
        OtpChallenge challenge = challengeRepository.findByTargetForUpdate(normalizedTarget).orElse(null);
        LocalDateTime now = LocalDateTime.now(clock);
        if (challenge == null || now.isAfter(challenge.getExpiresAt())) {
            challengeRepository.deleteByTargetIgnoreCase(normalizedTarget);
            return new Status(VerifyResult.EXPIRED_OR_NOT_FOUND, 0);
        }
        if (challenge.getPurpose() == null) {
            challengeRepository.delete(challenge);
            return new Status(VerifyResult.EXPIRED_OR_NOT_FOUND, 0);
        }
        if (challenge.getPurpose() != requiredPurpose) {
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
