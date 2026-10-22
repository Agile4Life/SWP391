package com.swp391.scms.support.dto;

import java.time.LocalDateTime;

public record SupportRequestMessageDto(
    Long id,
    Long supportRequestId,
    Long senderId,
    String senderName,
    String senderRole,
    String message,
    LocalDateTime createdAt
) {}

