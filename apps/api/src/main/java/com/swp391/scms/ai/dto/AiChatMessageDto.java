package com.swp391.scms.ai.dto;

import java.time.LocalDateTime;

/**
 * Một tin trong phiên chat AI: phiên, người gửi (member hoặc ai), nội dung và thời điểm.
 *
 * Response DTO representing a single message in an AI chat session.
 */
public record AiChatMessageDto(
        Long id,
        Long sessionId,
        String sender,
        String message,
        LocalDateTime createdAt
) {
}
