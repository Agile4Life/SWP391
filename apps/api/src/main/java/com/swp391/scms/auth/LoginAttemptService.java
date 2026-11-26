package com.swp391.scms.auth;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
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
    public static final int MAX_TRACKED_IDENTIFIERS = 10_000;
    private static final long STALE_WINDOW_SECONDS = LOCKOUT_DURATION_SECONDS * 10;

    /** Bản ghi bất biến số lần sai của một định danh: số lần sai, khóa đến lúc nào và lần thử gần nhất. */
    private record AttemptRecord(int failedAttempts, Instant lockedUntil, Instant lastAttempt) {
        boolean isExpired(Instant now) {
            if (lockedUntil != null) {
                return !now.isBefore(lockedUntil);
            }
            return lastAttempt != null && now.isAfter(lastAttempt.plusSeconds(STALE_WINDOW_SECONDS));
        }
    }

    private final Map<String, AttemptRecord> attempts = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int maxEntries;

    /** Constructor mặc định dùng đồng hồ UTC. */
    public LoginAttemptService() {
        this(Clock.systemUTC(), MAX_TRACKED_IDENTIFIERS);
    }

    /** Constructor nhận Clock để test điều khiển thời gian. */
    public LoginAttemptService(Clock clock) {
        this(clock, MAX_TRACKED_IDENTIFIERS);
    }

    /** Constructor cho test kiểm soát giới hạn kích thước bộ nhớ đệm. */
    LoginAttemptService(Clock clock, int maxEntries) {
        this.clock = clock;
        this.maxEntries = Math.max(1, maxEntries);
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
        if (record.lockedUntil() != null) {
            if (now.isBefore(record.lockedUntil())) {
                return true;
            }
            // Hết thời gian khóa -> chỉ xóa nếu đúng bản ghi đã đọc (tránh xóa nhầm bản ghi mới ghi đồng thời)
            attempts.remove(key, record);
            return false;
        }
        if (record.isExpired(now)) {
            attempts.remove(key, record);
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
        if (record == null || record.lockedUntil() == null) {
            return 0;
        }

        Instant now = clock.instant();
        long diff = record.lockedUntil().getEpochSecond() - now.getEpochSecond();
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
        Instant now = clock.instant();
        if (record.isExpired(now)) {
            attempts.remove(key, record);
            return MAX_FAILED_ATTEMPTS;
        }
        return Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts());
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
        evictIfNeeded(key, now);

        AttemptRecord record = attempts.compute(key, (k, existing) -> {
            if (existing == null || existing.isExpired(now)) {
                return new AttemptRecord(1, null, now);
            }
            int nextAttempts = existing.failedAttempts() + 1;
            Instant nextLockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
                    ? now.plusSeconds(LOCKOUT_DURATION_SECONDS)
                    : existing.lockedUntil();
            return new AttemptRecord(nextAttempts, nextLockedUntil, now);
        });

        if (record.lockedUntil() != null && now.isBefore(record.lockedUntil())) {
            return 0; // Đã bị khóa
        }
        return Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts());
    }

    /** Dọn các bản ghi hết hạn và kẹp kích thước map khi gần ngưỡng để chống phình RAM khi nhận username ngẫu nhiên. */
    private void evictIfNeeded(String incomingKey, Instant now) {
        if (attempts.size() < maxEntries || attempts.containsKey(incomingKey)) {
            return;
        }
        for (Map.Entry<String, AttemptRecord> entry : attempts.entrySet()) {
            AttemptRecord rec = entry.getValue();
            if (rec != null && rec.isExpired(now)) {
                attempts.remove(entry.getKey(), rec);
            }
        }
        int excess = attempts.size() - maxEntries + 1;
        if (excess > 0) {
            attempts.entrySet().stream()
                    .sorted(Comparator.comparing(e -> e.getValue().lastAttempt() != null ? e.getValue().lastAttempt() : Instant.EPOCH))
                    .limit(excess)
                    .forEach(e -> attempts.remove(e.getKey(), e.getValue()));
        }
    }

    /** Số định danh hiện đang được theo dõi (dùng cho test kiểm tra giới hạn bộ nhớ). */
    int trackedCount() {
        return attempts.size();
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

    /** Xóa toàn bộ bộ đếm (dùng cho test). */
    public void clearAll() {
        attempts.clear();
    }

    /** Chuẩn hóa định danh: bỏ khoảng trắng hai đầu và chuyển chữ thường. */
    private String normalize(String target) {
        return target.trim().toLowerCase(Locale.ROOT);
    }
}
