package com.swp391.scms.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

class LoginAttemptServiceTest {

    private MutableClock clock;
    private LoginAttemptService service;

    private static class MutableClock extends Clock {
        private Instant now;
        private final ZoneId zone;

        MutableClock(Instant start, ZoneId zone) {
            this.now = start;
            this.zone = zone;
        }

        void advanceSeconds(long seconds) {
            this.now = this.now.plusSeconds(seconds);
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new MutableClock(now, zone);
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-11-09T03:00:00Z"), ZoneId.of("UTC"));
        service = new LoginAttemptService(clock);
    }

    @Test
    @DisplayName("Initial state has 5 remaining attempts and is not blocked")
    void initialState() {
        assertFalse(service.isBlocked("testuser"));
        assertEquals(5, service.getRemainingAttempts("testuser"));
        assertEquals(0, service.getRemainingLockoutSeconds("testuser"));
    }

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

    @Test
    @DisplayName("5th failure triggers lockout for 60 seconds (1 minute)")
    void fifthFailureLocksForOneMinute() {
        for (int i = 1; i <= 4; i++) {
            service.recordFailure("testuser");
        }
        assertEquals(0, service.recordFailure("testuser"));
        assertTrue(service.isBlocked("testuser"));
        assertEquals(60, service.getRemainingLockoutSeconds("testuser"));

        // Advance 30 seconds -> still blocked with 30s remaining
        clock.advanceSeconds(30);
        assertTrue(service.isBlocked("testuser"));
        assertEquals(30, service.getRemainingLockoutSeconds("testuser"));

        // Advance another 31 seconds (total 61s) -> unblocked!
        clock.advanceSeconds(31);
        assertFalse(service.isBlocked("testuser"));
        assertEquals(0, service.getRemainingLockoutSeconds("testuser"));
    }

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

    @Test
    @DisplayName("Username normalization treats case and whitespace equally")
    void normalization() {
        service.recordFailure("  User@Gmail.Com ");
        assertEquals(4, service.getRemainingAttempts("user@gmail.com"));
        service.loginSucceeded("USER@GMAIL.COM");
        assertEquals(5, service.getRemainingAttempts("user@gmail.com"));
    }
}
