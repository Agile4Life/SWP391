package com.swp391.scms.chat.dto;
import java.time.Instant;
import java.util.UUID;
/** Một tin nhắn: id, hội thoại, mã tin phía client, người gửi, có phải của mình không, nội dung và thời điểm. */
public record ChatMessageDto(Long id, Long conversationId, UUID clientMessageId, Long senderId, boolean mine, String message, Instant createdAt) { }
