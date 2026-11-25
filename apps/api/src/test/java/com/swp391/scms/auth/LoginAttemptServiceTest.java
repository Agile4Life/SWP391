package com.swp391.scms.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

/** Bộ kiểm thử cho service LoginAttemptService (login attempt service). */
class LoginAttemptServiceTest {

    private MutableClock clock;
    private LoginAttemptService service;

    /** Đồng hồ giả lập cho test, cho phép chỉnh thời gian bằng tay. */
    private static class MutableClock extends Clock {
        private Instant now;
        private final ZoneId zone;

        MutableClock(Instant start, ZoneId zone) {
            this.now = start;
            this.zone = zone;
        }

        /** Hàm trợ giúp của test: tua đồng hồ giả thêm số giây cho trước. */
        void advanceSeconds(long seconds) {
            this.now = this.now.plusSeconds(seconds);
        }

        /** Trả về múi giờ của đồng hồ giả. */
        @Override
        public ZoneId getZone() {
            return zone;
        }

        /** Tạo bản sao đồng hồ giả với múi giờ khác. */
        @Override
        public Clock withZone(ZoneId zone) {
            return new MutableClock(now, zone);
        }

        /** Trả về thời điểm hiện tại của đồng hồ giả. */
        @Override
        public Instant instant() {
            return now;
        }
    }

    /** Chuẩn bị trước mỗi test: tạo LoginAttemptService với đồng hồ giả. */
    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-11-09T03:00:00Z"), ZoneId.of("UTC"));
        service = new LoginAttemptService(clock);
    }

    /** Kiểm thử: trạng thái ban đầu chưa có lần thất bại nào. */
    @Test
    @DisplayName("Initial state has 5 remaining attempts and is not blocked")
    void initialState() {
        assertFalse(service.isBlocked("testuser"));
        assertEquals(5, service.getRemainingAttempts("testuser"));
        assertEquals(0, service.getRemainingLockoutSeconds("testuser"));
    }

    /** Kiểm thử: bốn lần thất bại đầu chưa khóa. */
    @Test
    @DisplayName("First 4 failures decrement remaining attempts without blocking")
    void firstFourFailures() {
        assertEquals(4, service.recordFailure("testuser"));
        assertFalse(service.isBlocked("testuser"));

        assertEquals(3, service.recordFailure("testuser"));
        assertFalse(service.isBlocked("testuser"));

        assertEquals(2, service.recordFailure("testuser"));
        assertFalse(service.isBlocked("testuser"));

        assertEquals(1, service.recordFailure("testuser"));
        assertFalse(service.isBlocked("testuser"));
    }

    /** Kiểm thử: lần thất bại thứ năm khóa tài khoản một phút. */
    @Test
    @DisplayName("5th failure triggers lockout for 60 seconds (1 minute)")
    void fifthFailureLocksForOneMinute() {
        for (int i = 1; i <= 4; i++) {
            service.recordFailure("testuser");
        }
        assertEquals(0, service.recordFailure("testuser"));
        assertTrue(service.isBlocked("testuser"));
        assertEquals(60, service.getRemainingLockoutSeconds("testuser"));

        // Tua thêm 30 giây -> vẫn bị khóa với 30 giây còn lại
        clock.advanceSeconds(30);
        assertTrue(service.isBlocked("testuser"));
        assertEquals(30, service.getRemainingLockoutSeconds("testuser"));

        // Tua thêm 31 giây nữa (tổng 61 giây) -> đã mở khóa!
        clock.advanceSeconds(31);
        assertFalse(service.isBlocked("testuser"));
        assertEquals(0, service.getRemainingLockoutSeconds("testuser"));
    }

    /** Kiểm thử: đăng nhập thành công đặt lại bộ đếm. */
    @Test
    @DisplayName("Successful login resets failed attempts")
    void loginSuccessResetsCounter() {
        service.recordFailure("testuser");
        service.recordFailure("testuser");
        assertEquals(3, service.getRemainingAttempts("testuser"));

        service.loginSucceeded("testuser");
        assertEquals(5, service.getRemainingAttempts("testuser"));
        assertFalse(service.isBlocked("testuser"));
    }

    /** Kiểm thử: định danh đăng nhập được chuẩn hóa (hoa/thường, khoảng trắng) trước khi đếm. */
    @Test
    @DisplayName("Username normalization treats case and whitespace equally")
    void normalization() {
        service.recordFailure("  User@Gmail.Com ");
        assertEquals(4, service.getRemainingAttempts("user@gmail.com"));
        service.loginSucceeded("USER@GMAIL.COM");
        assertEquals(5, service.getRemainingAttempts("user@gmail.com"));
    }

    /** Kiểm thử P2-BE-01: map theo dõi bị giới hạn kích thước tối đa và tự dọn bản ghi hết hạn để chống OOM. */
    @Test
    @DisplayName("Tracked identifiers stay bounded and expired records are evicted")
    void trackedIdentifiersStayBoundedAndExpiredRecordsEvicted() {
        LoginAttemptService bounded = new LoginAttemptService(clock, 10);
        for (int i = 0; i < 25; i++) {
            bounded.recordFailure("random-user-" + i);
            clock.advanceSeconds(1);
        }
        assertTrue(bounded.trackedCount() <= 10, "expected <= 10 entries, got " + bounded.trackedCount());

        // Sau cửa sổ 10 phút không hoạt động, các bản ghi chưa khóa hết hạn và trả đủ 5 lượt thử.
        clock.advanceSeconds(601);
        assertEquals(5, bounded.getRemainingAttempts("random-user-24"));
        assertFalse(bounded.isBlocked("random-user-24"));
    }
}
