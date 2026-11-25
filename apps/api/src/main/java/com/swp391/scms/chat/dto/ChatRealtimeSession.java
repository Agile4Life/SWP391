package com.swp391.scms.chat.dto;
import java.time.Instant;
/**
 * Phiên realtime Supabase: đã bật chưa, người dùng, địa chỉ, khóa publishable, chủ đề được nghe, token ngắn hạn
 * và thời điểm hết hạn.
 */
public record ChatRealtimeSession(boolean enabled, Long userId, String url, String publishableKey, String topic, String token, Instant expiresAt) { }
