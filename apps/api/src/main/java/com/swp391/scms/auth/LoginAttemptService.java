package com.swp391.scms.auth;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quản lý số lần đăng nhập thất bại và khóa tạm thời tài khoản theo thời gian.
 * Quy tắc: Đăng nhập sai quá 5 lần sẽ khóa tạm thời trong 1 phút (60 giây).
 */
@Service
public class LoginAttemptService {

    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final long LOCKOUT_DURATION_SECONDS = 60L; // 1 phút

    private static class AttemptRecord {
        int failedAttempts;
        Instant lockedUntil;
        Instant lastAttempt;

        AttemptRecord(Instant now) {
            this.failedAttempts = 1;
            this.lastAttempt = now;
            this.lockedUntil = null;
        }
    }

    private final Map<String, AttemptRecord> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    public LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    /**
     * Kiểm tra xem định danh (username/email/phone) có đang bị tạm khóa hay không.
     */
    public boolean isBlocked(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return false;
        }
        String key = normalize(identifier);
        AttemptRecord record = attempts.get(key);
        if (record == null) {
            return false;
        }

        Instant now = clock.instant();
        if (record.lockedUntil != null) {
            if (now.isBefore(record.lockedUntil)) {
                return true;
            }
            // Hết thời gian khóa -> mở khóa và reset
            attempts.remove(key);
            return false;
        }
        return false;
    }

    /**
     * Lấy số giây còn lại bị khóa.
     */
    public long getRemainingLockoutSeconds(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return 0;
        }
        String key = normalize(identifier);
        AttemptRecord record = attempts.get(key);
        if (record == null || record.lockedUntil == null) {
            return 0;
        }

        Instant now = clock.instant();
        long diff = record.lockedUntil.getEpochSecond() - now.getEpochSecond();
        return Math.max(0, diff);
    }

    /**
     * Lấy số lần thử còn lại trước khi bị khóa (tối đa 5).
     */
    public int getRemainingAttempts(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return MAX_FAILED_ATTEMPTS;
        }
        String key = normalize(identifier);
        AttemptRecord record = attempts.get(key);
        if (record == null) {
            return MAX_FAILED_ATTEMPTS;
        }
        return Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts);
    }

    /**
     * Ghi nhận một lần đăng nhập thất bại.
     * @return số lần thử còn lại (0 nếu đã bị khóa).
     */
    public int recordFailure(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return 0;
        }
        String key = normalize(identifier);
        Instant now = clock.instant();

        AttemptRecord record = attempts.compute(key, (k, existing) -> {
            if (existing == null) {
                return new AttemptRecord(now);
            }
            // Nếu lần thử trước đã quá 10 phút trước và chưa bị khóa, reset fresh
            if (existing.lockedUntil == null && existing.lastAttempt != null
                    && now.isAfter(existing.lastAttempt.plusSeconds(LOCKOUT_DURATION_SECONDS * 10))) {
                return new AttemptRecord(now);
            }
            // Nếu khóa cũ đã hết hạn, bắt đầu chu kỳ mới với 1 lần sai
            if (existing.lockedUntil != null && now.isAfter(existing.lockedUntil)) {
                return new AttemptRecord(now);
            }

            existing.failedAttempts++;
            existing.lastAttempt = now;
            if (existing.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                existing.lockedUntil = now.plusSeconds(LOCKOUT_DURATION_SECONDS);
            }
            return existing;
        });

        if (record.lockedUntil != null && now.isBefore(record.lockedUntil)) {
            return 0; // Đã bị khóa
        }
        return Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts);
    }

    /**
     * Đăng nhập thành công -> xóa bỏ mọi ghi nhận thất bại trước đó.
     */
    public void loginSucceeded(String identifier) {
        if (identifier != null && !identifier.isBlank()) {
            attempts.remove(normalize(identifier));
        }
    }

    /**
     * Xóa thủ công hoặc dùng cho test.
     */
    public void reset(String identifier) {
        if (identifier != null && !identifier.isBlank()) {
            attempts.remove(normalize(identifier));
        }
    }

    public void clearAll() {
        attempts.clear();
    }

    private String normalize(String target) {
        return target.trim().toLowerCase(Locale.ROOT);
    }
}
