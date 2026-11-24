package com.swp391.scms.notifications.port;

/**
 * Các kênh gửi thông báo: trong ứng dụng, email, đẩy và webhook.
 *
 * Supported notification channels for multi-channel dispatching (SCRUM-108).
 */
public enum NotificationChannel {
    IN_APP,
    EMAIL,
    PUSH,
    WEBHOOK
}

