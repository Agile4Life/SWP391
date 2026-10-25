package com.swp391.scms.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for sending a message in an AI chat session.
 */
public record AiChatMessageCreateDto(
        @NotBlank(message = "{validation.ai.chat.message.required}")
        @Size(max = 2000, message = "{validation.ai.chat.message.size}")
        String message
) {
}
