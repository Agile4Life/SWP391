package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter for simulated webhook dispatching (SCRUM-108).
 */
@Component
public class MockWebhookNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockWebhookNotificationChannelAdapter.class);

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.WEBHOOK;
    }

    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        log.info("""
                [MOCK-WEBHOOK] ========================================================
                [MOCK-WEBHOOK] HTTP POST -> https://webhook.internal/events/notifications
                [MOCK-WEBHOOK] Event Type: {}
                [MOCK-WEBHOOK] User ID: {}
                [MOCK-WEBHOOK] Entity: {} #{}
                [MOCK-WEBHOOK] Title: {}
                [MOCK-WEBHOOK] Message: {}
                [MOCK-WEBHOOK] Timestamp: {}
                [MOCK-WEBHOOK] Status: 200 OK (Simulated)
                [MOCK-WEBHOOK] ========================================================""",
                payload.type(), payload.userId(), payload.relatedEntityType(),
                payload.relatedEntityId(), payload.title(), payload.message(),
                payload.timestamp());
    }
}

