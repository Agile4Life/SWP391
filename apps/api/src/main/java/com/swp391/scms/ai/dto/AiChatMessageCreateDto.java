package com.swp391.scms.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Tin nhắn gửi cho AI: phiên (tùy chọn), chủ đề (tùy chọn) và nội dung.
 *
 * Payload yêu cầu gửi một tin nhắn trong phiên chat AI.
 */
public record AiChatMessageCreateDto(
        Long sessionId,
        @Size(max = 150, message = "{validation.ai.chat.topic.size}")
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
