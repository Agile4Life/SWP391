package com.swp391.scms.notifications.port;

/**
 * Giao diện adapter cho từng kênh thông báo riêng lẻ (SCRUM-108).
 * Các lớp triển khai xử lý từng kênh gửi cụ thể (ví dụ: IN_APP, EMAIL, PUSH, WEBHOOK).
 */
public interface NotificationChannelAdapter {

    /** Kênh thông báo được adapter này hỗ trợ. */
    NotificationChannel getChannel();

    /** Gửi payload thông báo qua kênh của adapter này. */
    void send(NotificationPayload payload);

    /**
     * Gửi kèm khóa giao hàng ổn định do tầng truyền tải bền vững cung cấp (mặc định bỏ qua khóa). Các nhà cung
     * cấp thật nên dùng khóa này cho API idempotency để chống gửi trùng.
     */
    default void send(NotificationPayload payload, String deliveryKey) {
        send(payload);
    }
}

