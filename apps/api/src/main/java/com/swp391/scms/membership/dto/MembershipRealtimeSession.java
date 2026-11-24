package com.swp391.scms.membership.dto;

/**
 * Thông tin mở kênh realtime: đã bật chưa, địa chỉ Supabase, khóa publishable (an toàn để lộ ở trình duyệt) và
 * tên chủ đề riêng của hội viên.
 *
 * Only a public API key and an opaque, data-free invalidation channel.
 */
public record MembershipRealtimeSession(boolean enabled, String url, String publishableKey, String topic) {}
