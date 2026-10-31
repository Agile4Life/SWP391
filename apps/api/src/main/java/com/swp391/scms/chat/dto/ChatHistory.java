package com.swp391.scms.chat.dto;
import java.util.List;
public record ChatHistory(List<ChatMessageDto> items, boolean hasMore) { }
