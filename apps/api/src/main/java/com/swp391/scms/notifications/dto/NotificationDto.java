package com.swp391.scms.notifications.dto;

import java.time.LocalDateTime;

public record NotificationDto(
    Long id,
    String title,
    String message,
    String type,
    String relatedEntityType,
    Long relatedEntityId,
    boolean isRead,
    LocalDateTime createdAt
) {}

