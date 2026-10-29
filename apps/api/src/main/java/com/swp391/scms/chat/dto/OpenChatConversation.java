package com.swp391.scms.chat.dto;
import jakarta.validation.constraints.*;
public record OpenChatConversation(@NotNull(message = "{validation.chat.contact}") @Positive(message = "{validation.chat.contact}") Long contactId) { }
