package com.swp391.scms.chat.dto;
import jakarta.validation.constraints.*;
/** Mở hội thoại với người liên hệ có id này. */
public record OpenChatConversation(@NotNull(message = "{validation.chat.contact}") @Positive(message = "{validation.chat.contact}") Long contactId) { }
