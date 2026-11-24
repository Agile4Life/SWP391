package com.swp391.scms.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Dữ liệu gửi tin nhắn: nội dung và mã tin phía client (để gửi lại không bị trùng). */
public record CreateSupportMessageDto(
    @NotBlank(message = "{validation.support.message.not_blank}")
    @Size(max = 2000, message = "{validation.support.message.size}")
    String message,
    java.util.UUID clientMessageId
) {
    /** Constructor không có mã tin phía client. */
    public CreateSupportMessageDto(String message) { this(message, null); }
}

