package com.swp391.scms.ai.dto;

import java.time.LocalDateTime;

/**
 * Một tin trong phiên chat AI: phiên, người gửi (member hoặc ai), nội dung và thời điểm.
 *
 * DTO phản hồi biểu diễn một tin nhắn trong phiên chat AI.
 */
public record AiChatMessageDto(
        Long id,
        Long sessionId,
        String sender,
        String message,
        LocalDateTime createdAt
) {
}
