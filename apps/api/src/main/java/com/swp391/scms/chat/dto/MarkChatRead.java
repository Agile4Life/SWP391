package com.swp391.scms.chat.dto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
/** Đánh dấu đã đọc tới tin có id này. */
public record MarkChatRead(@NotNull @Positive Long lastMessageId) { }
