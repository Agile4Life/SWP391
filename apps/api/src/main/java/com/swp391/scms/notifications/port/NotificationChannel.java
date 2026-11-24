package com.swp391.scms.notifications.port;

/**
 * Các kênh thông báo được hỗ trợ cho việc phát thông báo đa kênh (SCRUM-108): trong ứng dụng, email, đẩy và webhook.
 */
public enum NotificationChannel {
    IN_APP,
    EMAIL,
    PUSH,
    WEBHOOK
}

