package com.swp391.scms.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Tin nhắn gửi cho AI: phiên (tùy chọn), chủ đề (tùy chọn) và nội dung.
 *
 * Request payload for sending a message in an AI chat session.
 */
public record AiChatMessageCreateDto(
        Long sessionId,
        String topic,
        @NotBlank(message = "{validation.ai.chat.message.required}")
        @Size(max = 2000, message = "{validation.ai.chat.message.size}")
        String message
) {
    /** Constructor chỉ có nội dung. */
    public AiChatMessageCreateDto(String message) {
        this(null, null, message);
    }
}
