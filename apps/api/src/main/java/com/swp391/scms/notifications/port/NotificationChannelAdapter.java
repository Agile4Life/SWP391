package com.swp391.scms.notifications.port;

/**
 * Cổng (interface) cho một kênh gửi thông báo.
 *
 * Adapter interface for individual notification channels (SCRUM-108).
 * Implementations handle specific delivery channels (e.g. IN_APP, EMAIL, PUSH, WEBHOOK).
 */
public interface NotificationChannelAdapter {

    /**
     * Kênh mà adapter này phụ trách.
     *
     * The notification channel supported by this adapter.
     */
    NotificationChannel getChannel();

    /**
     * Gửi thông báo qua kênh.
     *
     * Deliver the notification payload via this adapter's channel.
     */
    void send(NotificationPayload payload);

    /**
     * Gửi kèm khóa giao hàng (dùng để chống gửi trùng); mặc định bỏ qua khóa.
     *
     * Durable transport supplies a stable key. Real providers should use it for their idempotency API.
     */
    default void send(NotificationPayload payload, String deliveryKey) {
        send(payload);
    }
}

