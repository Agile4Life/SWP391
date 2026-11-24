package com.swp391.scms.notifications.port;

import java.util.Set;

/**
 * Giao diện cổng (port) cho việc phát thông báo đa kênh (SCRUM-108).
 * Gửi yêu cầu phát thông báo trong ứng dụng, email mô phỏng, thông báo đẩy và webhook tới tầng truyền tải đã chọn.
 */
public interface NotificationDispatcher {

    /** Phát thông báo tới các kênh được chỉ định trong payload (thực hiện bất đồng bộ). */
    void dispatch(NotificationPayload payload);

    /** Phát thông báo tới toàn bộ các kênh mặc định (IN_APP, EMAIL, PUSH). */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId);

    /** Phát thông báo tới tập kênh được chỉ định tường minh. */
    void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId, Set<NotificationChannel> channels);
}

