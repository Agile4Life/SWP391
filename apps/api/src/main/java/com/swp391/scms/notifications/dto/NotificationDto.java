package com.swp391.scms.notifications.dto;

import java.time.LocalDateTime;

/**
 * Thông báo trả cho client: tiêu đề, nội dung, loại, bản ghi liên quan, đã đọc chưa, thời điểm tạo và đường dẫn
 * mở trang.
 */
public record NotificationDto(
    Long id,
    String title,
    String message,
    String type,
    String relatedEntityType,
    Long relatedEntityId,
    boolean isRead,
    LocalDateTime createdAt,
    String actionPath
) {
    /** Constructor không có đường dẫn mở trang. */
    public NotificationDto(Long id, String title, String message, String type, String relatedEntityType,
            Long relatedEntityId, boolean isRead, LocalDateTime createdAt) {
        this(id, title, message, type, relatedEntityType, relatedEntityId, isRead, createdAt, null);
    }
}

