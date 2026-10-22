package com.swp391.scms.notifications.port;

import java.util.Set;

/**
 * Port interface for multi-channel notification dispatching (SCRUM-108).
 * Provides asynchronous, non-blocking dispatch across in-app, simulated email, push, and webhook.
 */
public interface NotificationDispatcher {

    /**
     * Dispatches notification across channels specified in the payload.
     * Non-blocking and executed asynchronously.
     */
    void dispatch(NotificationPayload payload);

    /**
     * Dispatches notification to all standard channels (IN_APP, EMAIL, PUSH).
     */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId);

    /**
     * Dispatches notification with explicitly selected channels.
     */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId, Set<NotificationChannel> channels);
}

