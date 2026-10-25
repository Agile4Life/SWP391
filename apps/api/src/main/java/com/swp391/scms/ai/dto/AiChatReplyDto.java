package com.swp391.scms.ai.dto;

/**
 * Response DTO returned when a member sends a message to an AI chat session.
 */
public record AiChatReplyDto(
        Long sessionId,
        AiChatMessageDto memberMessage,
        AiChatMessageDto aiMessage,
        String reply
) {
}
