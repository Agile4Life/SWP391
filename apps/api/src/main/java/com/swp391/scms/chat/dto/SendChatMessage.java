package com.swp391.scms.chat.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
/** Gửi tin: mã tin phía client (UUID, gửi lại cùng mã không bị trùng) và nội dung (tối đa 2000 ký tự). */
public record SendChatMessage(@NotNull(message = "{validation.chat.client_id}") UUID clientMessageId,
        @NotBlank(message = "{validation.chat.message}") @Size(max = 2000, message = "{validation.chat.message}") String message) { }
