package com.swp391.scms.ai.dto;

/**
 * Kết quả gửi tin: phiên, tin của người hỏi, tin trả lời của AI và nội dung trả lời.
 *
 * DTO phản hồi trả về khi hội viên gửi tin nhắn vào phiên chat AI.
 */
public record AiChatReplyDto(
        Long sessionId,
        AiChatMessageDto memberMessage,
        AiChatMessageDto aiMessage,
        String reply
) {
}
