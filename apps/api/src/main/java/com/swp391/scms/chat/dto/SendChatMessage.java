package com.swp391.scms.chat.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
public record SendChatMessage(@NotNull(message = "{validation.chat.client_id}") UUID clientMessageId,
        @NotBlank(message = "{validation.chat.message}") @Size(max = 2000, message = "{validation.chat.message}") String message) { }
