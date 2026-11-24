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
 * Giới hạn số tin mỗi tài khoản gửi cho AI (mặc định 15 tin trong 10 phút trượt) vì mỗi tin tốn tiền gọi nhà
 * cung cấp. Đếm từ tin đã lưu trong database (không mất khi khởi động lại, dùng chung giữa các instance) cộng
 * các request đang chờ trong bộ nhớ (để nhiều tin gửi cùng lúc không lọt qua).
 *
 * Giới hạn tần suất một tài khoản nói chuyện với trợ lý AI (mặc định 15 tin trong 10 phút trượt), vì mỗi tin
 * tốn một lần gọi nhà cung cấp trả phí. Số đếm lấy từ các tin của hội viên đã lưu, nên bền qua khởi động lại
 * và dùng chung giữa mọi instance API; các request còn chờ nhà cung cấp được đếm trong bộ nhớ để một loạt lần
 * gửi đồng thời không lọt qua giới hạn trước khi kịp lưu.
 */
@Component
public class AiChatRateLimiter {
    /** Độ trễ gợi ý khi giới hạn chỉ bị giữ bởi các request còn đang xử lý. */
    private static final long IN_FLIGHT_RETRY_SECONDS = 5;

    private final AiChatMessageRepository messages;
    private final int maxMessages;
    private final Duration window;
    private final Clock clock;
    private final Map<Long, Integer> inFlight = new ConcurrentHashMap<>();
    private final Map<Long, Object> locks = new ConcurrentHashMap<>();

    /** Constructor Spring dùng: đọc số tin tối đa và độ dài cửa sổ từ cấu hình. */
    @Autowired
    public AiChatRateLimiter(AiChatMessageRepository messages,
                             @Value("${app.ai.chat.rate-limit.max-messages:15}") int maxMessages,
                             @Value("${app.ai.chat.rate-limit.window-minutes:10}") int windowMinutes) {
        this(messages, maxMessages, Duration.ofMinutes(windowMinutes), Clock.systemDefaultZone());
    }

    /** Constructor cho test với Clock tùy chỉnh. */
    public AiChatRateLimiter(AiChatMessageRepository messages, int maxMessages, Duration window, Clock clock) {
        this.messages = messages;
        this.maxMessages = Math.max(1, maxMessages);
        this.window = window;
        this.clock = clock;
    }

    /**
     * Một suất gửi tin đã giữ chỗ; phải trả lại khi request xong, dù tin có được lưu hay không.
     *
     * Một chỗ đã đặt trước; hãy nhả nó khi request kết thúc, dù tin nhắn có được lưu hay không.
     */
    public final class Permit {
        private final Long userId;
        private boolean released;

        /** Tạo suất cho người dùng. */
        private Permit(Long userId) { this.userId = userId; }

        /** Trả suất (chỉ một lần): giảm bộ đếm request đang chờ của người dùng. */
        public synchronized void release() {
            if (released || userId == null) return;
            released = true;
            synchronized (lockFor(userId)) {
                inFlight.merge(userId, -1, (a, b) -> a + b <= 0 ? null : a + b);
            }
        }
    }

    /**
     * Giữ một suất gửi tin hoặc báo lỗi 429 kèm thời gian cần chờ.
     *
     * Đặt trước một tin nhắn cho tài khoản hoặc ném 429 kèm thời gian phải chờ.
     */
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

    /**
     * Số giây cần chờ: tin cũ nhất phải ra khỏi cửa sổ thì mới có chỗ; nếu chỉ vướng request đang chờ thì đề
     * nghị chờ 5 giây.
     */
    private long retrySeconds(List<LocalDateTime> stored, int used, LocalDateTime now) {
        // Các tin rời khỏi cửa sổ theo thứ tự cũ nhất trước; cần hết hạn chừng này tin mới có chỗ cho thêm một
        // tin.
        int mustExpire = used - maxMessages + 1;
        if (mustExpire > stored.size()) {
            return IN_FLIGHT_RETRY_SECONDS;
        }
        LocalDateTime frees = stored.get(mustExpire - 1).plus(window);
        return Math.max(1, Duration.between(now, frees).toSeconds());
    }

    /** Lỗi 429 với số tin tối đa, độ dài cửa sổ và số phút cần chờ. */
    private TooManyRequestsException limited(long retrySeconds) {
        long waitMinutes = Math.max(1, (retrySeconds + 59) / 60);
        return new TooManyRequestsException("AI_CHAT_RATE_LIMITED", "ai.chat.rate_limited",
                new Object[]{maxMessages, window.toMinutes(), waitMinutes},
                "Bạn đã gửi tối đa " + maxMessages + " tin nhắn cho SÖL AI trong " + window.toMinutes()
                        + " phút. Vui lòng thử lại sau khoảng " + waitMinutes + " phút.");
    }

    /** Đối tượng khóa riêng cho từng người dùng. */
    private Object lockFor(Long userId) {
        return locks.computeIfAbsent(userId == null ? -1L : userId, key -> new Object());
    }
}
