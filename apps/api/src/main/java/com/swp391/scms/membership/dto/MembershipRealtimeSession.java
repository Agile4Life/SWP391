package com.swp391.scms.membership.dto;

/**
 * Thông tin mở kênh realtime: đã bật chưa, địa chỉ Supabase, khóa API công khai (publishableKey, an toàn khi hiển thị
 * ở trình duyệt) và tên kênh thông báo vô hiệu hóa mờ đục, không chứa dữ liệu nhạy cảm.
 */
public record MembershipRealtimeSession(boolean enabled, String url, String publishableKey, String topic) {}
