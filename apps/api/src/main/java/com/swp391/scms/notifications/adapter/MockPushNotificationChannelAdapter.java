package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter for simulated mock push notifications with structured logging (SCRUM-108).
 */
@Component
public class MockPushNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockPushNotificationChannelAdapter.class);

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.PUSH;
    }

    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        log.info("""
                [MOCK-PUSH] ========================================================
                [MOCK-PUSH] Target User ID: {}
                [MOCK-PUSH] Title: {}
                [MOCK-PUSH] Body: {}
                [MOCK-PUSH] Type: {}
                [MOCK-PUSH] Entity: {} #{}
                [MOCK-PUSH] Timestamp: {}
                [MOCK-PUSH] Delivery: Simulated Mobile APNs / FCM Push Success
                [MOCK-PUSH] ========================================================""",
                payload.userId(), payload.title(), payload.message(), payload.type(),
                payload.relatedEntityType(), payload.relatedEntityId(), payload.timestamp());
    }
}

