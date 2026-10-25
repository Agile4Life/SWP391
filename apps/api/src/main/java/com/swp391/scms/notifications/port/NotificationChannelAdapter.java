package com.swp391.scms.notifications.port;

/**
 * Adapter interface for individual notification channels (SCRUM-108).
 * Implementations handle specific delivery channels (e.g. IN_APP, EMAIL, PUSH, WEBHOOK).
 */
public interface NotificationChannelAdapter {

    /**
     * The notification channel supported by this adapter.
     */
    NotificationChannel getChannel();

    /**
     * Deliver the notification payload via this adapter's channel.
     */
    void send(NotificationPayload payload);
}

