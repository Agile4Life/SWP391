package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Kênh thông báo đẩy mô phỏng: chỉ ghi log (chưa tích hợp dịch vụ push thật).
 *
 * Adapter for simulated mock push notifications with structured logging (SCRUM-108).
 */
@Component
public class MockPushNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockPushNotificationChannelAdapter.class);

    /** Kênh PUSH. */
    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.PUSH;
    }

    /** Ghi log mô phỏng việc gửi thông báo đẩy. */
    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        log.info("[MOCK-PUSH] Simulated delivery for user {} (type={}, entity={} #{})",
                payload.userId(), payload.type(), payload.relatedEntityType(), payload.relatedEntityId());
    }
}

