package com.swp391.scms.support.dto;

import java.time.LocalDateTime;

/** Tin nhắn trong phiếu: người gửi (id, tên, vai trò), nội dung và thời điểm. */
public record SupportRequestMessageDto(
    Long id,
    Long supportRequestId,
    Long senderId,
    String senderName,
    String senderRole,
    String message,
    LocalDateTime createdAt
) {}

