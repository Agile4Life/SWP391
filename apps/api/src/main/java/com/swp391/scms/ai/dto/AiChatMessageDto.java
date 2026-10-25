package com.swp391.scms.ai.dto;

import java.time.LocalDateTime;

/**
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
