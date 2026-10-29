package com.swp391.scms.chat.dto;
import java.time.Instant;
public record ChatConversationDto(Long id, ChatContactDto peer, Instant createdAt, Instant lastActivityAt) { }
