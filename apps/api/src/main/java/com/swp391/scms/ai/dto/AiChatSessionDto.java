package com.swp391.scms.ai.dto;

import java.time.LocalDateTime;

/**
 * Response DTO representing an AI chat session.
 */
public record AiChatSessionDto(
        Long id,
        Long memberId,
        String topic,
        LocalDateTime startedAt,
        LocalDateTime endedAt
) {
}
