package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter kênh webhook mô phỏng (SCRUM-108): chỉ ghi log, chưa gọi hệ thống ngoài.
 */
@Component
public class MockWebhookNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockWebhookNotificationChannelAdapter.class);

    /** Kênh WEBHOOK. */
    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.WEBHOOK;
    }

    /** Ghi log mô phỏng việc gửi webhook. */
    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        log.info("[MOCK-WEBHOOK] Simulated delivery for user {} (type={}, entity={} #{})",
                payload.userId(), payload.type(), payload.relatedEntityType(), payload.relatedEntityId());
    }
}

