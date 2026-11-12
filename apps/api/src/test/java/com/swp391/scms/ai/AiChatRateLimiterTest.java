package com.swp391.scms.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.scms.ai.repository.AiChatMessageRepository;
import com.swp391.scms.ai.service.AiChatRateLimiter;
import com.swp391.scms.common.exception.TooManyRequestsException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AiChatRateLimiterTest {
    static final Instant NOW = Instant.parse("2026-11-12T03:00:00Z");
    final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    final LocalDateTime now = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);
    final AiChatMessageRepository messages = mock(AiChatMessageRepository.class);
    AiChatRateLimiter limiter;

    @BeforeEach void setUp() {
        limiter = new AiChatRateLimiter(messages, 15, Duration.ofMinutes(10), clock);
    }

    /** {@code n} stored messages, the first one {@code firstAgoSeconds} old and the rest one second apart after it. */
    private void stored(long userId, int n, long firstAgoSeconds) {
        List<LocalDateTime> times = new ArrayList<>();
        for (int i = 0; i < n; i++) times.add(now.minusSeconds(firstAgoSeconds - i));
        when(messages.memberMessageTimesSince(eq(userId), any())).thenReturn(times);
    }

    @Test void allowsUpToFifteenMessagesInTheWindow() {
        stored(1L, 14, 300);
        assertThat(limiter.acquire(1L)).isNotNull(); // the 15th
    }

    @Test void rejectsTheSixteenthMessageWithTheWaitTimeUntilTheOldestLeavesTheWindow() {
        stored(1L, 15, 540); // oldest sent 9 minutes ago -> room again in 1 minute
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOfSatisfying(TooManyRequestsException.class, e -> {
            assertThat(e.getStatus().value()).isEqualTo(429);
            assertThat(e.getErrorCode()).isEqualTo("AI_CHAT_RATE_LIMITED");
            assertThat(e.getMessageKey()).isEqualTo("ai.chat.rate_limited");
            assertThat(e.getMessageArgs()).containsExactly(15, 10L, 1L);
        });
    }

    @Test void waitIsRoundedUpToWholeMinutes() {
        stored(1L, 15, 60); // oldest 1 minute old -> 9 minutes left
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOfSatisfying(TooManyRequestsException.class,
                e -> assertThat(e.getMessageArgs()[2]).isEqualTo(9L));
    }

    @Test void messagesOutsideTheWindowAreNotCounted() {
        when(messages.memberMessageTimesSince(eq(1L), any())).thenReturn(List.of());
        assertThat(limiter.acquire(1L)).isNotNull();
    }

    @Test void eachAccountHasItsOwnBudget() {
        stored(1L, 15, 100);
        stored(2L, 3, 100);
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOf(TooManyRequestsException.class);
        assertThat(limiter.acquire(2L)).isNotNull();
    }

    @Test void requestsStillWaitingForTheProviderCountAgainstTheLimit() {
        when(messages.memberMessageTimesSince(eq(1L), any())).thenReturn(List.of());
        List<AiChatRateLimiter.Permit> held = new ArrayList<>();
        for (int i = 0; i < 15; i++) held.add(limiter.acquire(1L)); // 15 sends at once, none stored yet
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOfSatisfying(TooManyRequestsException.class,
                e -> assertThat(e.getMessageArgs()[2]).isEqualTo(1L));
        held.get(0).release(); // one finished without being stored (e.g. the provider failed)
        assertThat(limiter.acquire(1L)).isNotNull();
    }

    @Test void releasingTwiceDoesNotGiveBackTwoSlots() {
        when(messages.memberMessageTimesSince(eq(1L), any())).thenReturn(List.of());
        var first = limiter.acquire(1L);
        for (int i = 0; i < 14; i++) limiter.acquire(1L);
        first.release();
        first.release();
        limiter.acquire(1L); // exactly one slot came back
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOf(TooManyRequestsException.class);
    }

    @Test void anonymousCallersAreNotTracked() {
        assertThat(limiter.acquire(null)).isNotNull();
    }
}
