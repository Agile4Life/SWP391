package com.swp391.scms.ai.service;

import com.swp391.scms.ai.repository.AiChatMessageRepository;
import com.swp391.scms.common.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caps how often one account can talk to the AI assistant (default 15 messages per rolling 10 minutes), because every
 * message costs a call to a paid provider. The count comes from the stored member messages, so it survives restarts and
 * is shared by every API instance; requests still waiting for the provider are counted in memory so a burst of
 * simultaneous sends cannot slip past the limit before any of them is saved.
 */
@Component
public class AiChatRateLimiter {
    /** Delay suggested when the limit is held up only by requests that are still in flight. */
    private static final long IN_FLIGHT_RETRY_SECONDS = 5;

    private final AiChatMessageRepository messages;
    private final int maxMessages;
    private final Duration window;
    private final Clock clock;
    private final Map<Long, Integer> inFlight = new ConcurrentHashMap<>();
    private final Map<Long, Object> locks = new ConcurrentHashMap<>();

    @Autowired
    public AiChatRateLimiter(AiChatMessageRepository messages,
                             @Value("${app.ai.chat.rate-limit.max-messages:15}") int maxMessages,
                             @Value("${app.ai.chat.rate-limit.window-minutes:10}") int windowMinutes) {
        this(messages, maxMessages, Duration.ofMinutes(windowMinutes), Clock.systemDefaultZone());
    }

    public AiChatRateLimiter(AiChatMessageRepository messages, int maxMessages, Duration window, Clock clock) {
        this.messages = messages;
        this.maxMessages = Math.max(1, maxMessages);
        this.window = window;
        this.clock = clock;
    }

    /** A reserved slot; release it once the request finishes, whether or not the message was stored. */
    public final class Permit {
        private final Long userId;
        private boolean released;

        private Permit(Long userId) { this.userId = userId; }

        public synchronized void release() {
            if (released || userId == null) return;
            released = true;
            synchronized (lockFor(userId)) {
                inFlight.merge(userId, -1, (a, b) -> a + b <= 0 ? null : a + b);
            }
        }
    }

    /** Reserves one message for the account or throws 429 with how long to wait. */
    public Permit acquire(Long userId) {
        if (userId == null) {
            return new Permit(null);
        }
        synchronized (lockFor(userId)) {
            LocalDateTime now = LocalDateTime.now(clock);
            List<LocalDateTime> stored = messages.memberMessageTimesSince(userId, now.minus(window));
            int pending = inFlight.getOrDefault(userId, 0);
            int used = stored.size() + pending;
            if (used >= maxMessages) {
                throw limited(retrySeconds(stored, used, now));
            }
            inFlight.merge(userId, 1, Integer::sum);
            return new Permit(userId);
        }
    }

    private long retrySeconds(List<LocalDateTime> stored, int used, LocalDateTime now) {
        // Messages leave the window oldest first; this many must expire before there is room for one more.
        int mustExpire = used - maxMessages + 1;
        if (mustExpire > stored.size()) {
            return IN_FLIGHT_RETRY_SECONDS;
        }
        LocalDateTime frees = stored.get(mustExpire - 1).plus(window);
        return Math.max(1, Duration.between(now, frees).toSeconds());
    }

    private TooManyRequestsException limited(long retrySeconds) {
        long waitMinutes = Math.max(1, (retrySeconds + 59) / 60);
        return new TooManyRequestsException("AI_CHAT_RATE_LIMITED", "ai.chat.rate_limited",
                new Object[]{maxMessages, window.toMinutes(), waitMinutes},
                "Bạn đã gửi tối đa " + maxMessages + " tin nhắn cho SÖL AI trong " + window.toMinutes()
                        + " phút. Vui lòng thử lại sau khoảng " + waitMinutes + " phút.");
    }

    private Object lockFor(Long userId) {
        return locks.computeIfAbsent(userId == null ? -1L : userId, key -> new Object());
    }
}
