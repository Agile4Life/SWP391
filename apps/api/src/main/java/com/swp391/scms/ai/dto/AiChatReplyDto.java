package com.swp391.scms.ai.dto;

/**
 * Kết quả gửi tin: phiên, tin của người hỏi, tin trả lời của AI và nội dung trả lời.
 *
 * Response DTO returned when a member sends a message to an AI chat session.
 */
public record AiChatReplyDto(
        Long sessionId,
        AiChatMessageDto memberMessage,
        AiChatMessageDto aiMessage,
        String reply
) {
}
