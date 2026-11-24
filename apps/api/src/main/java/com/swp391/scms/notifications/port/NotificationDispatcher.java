package com.swp391.scms.notifications.port;

import java.util.Set;

/**
 * Cổng (interface) phát thông báo ra nhiều kênh.
 *
 * Port interface for multi-channel notification dispatching (SCRUM-108).
 * Submits in-app, simulated email, push and webhook delivery to the selected transport.
 */
public interface NotificationDispatcher {

    /**
     * Phát theo payload có sẵn.
     *
     * Dispatches notification across channels specified in the payload.
     * Delivery is asynchronous.
     */
    void dispatch(NotificationPayload payload);

    /**
     * Phát tới các kênh mặc định.
     *
     * Dispatches notification to all standard channels (IN_APP, EMAIL, PUSH).
     */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId);

    /**
     * Phát tới các kênh chỉ định.
     *
     * Dispatches notification with explicitly selected channels.
     */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId, Set<NotificationChannel> channels);
}

