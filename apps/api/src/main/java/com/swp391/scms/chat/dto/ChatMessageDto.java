package com.swp391.scms.chat.dto;
import java.time.Instant;
import java.util.UUID;
public record ChatMessageDto(Long id, Long conversationId, UUID clientMessageId, Long senderId, boolean mine, String message, Instant createdAt) { }
