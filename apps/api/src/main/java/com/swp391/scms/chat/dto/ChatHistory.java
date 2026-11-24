package com.swp391.scms.chat.dto;
import java.util.List;
/** Một trang lịch sử tin nhắn và cờ còn tin cũ hơn/mới hơn để tải tiếp. */
public record ChatHistory(List<ChatMessageDto> items, boolean hasMore) { }
