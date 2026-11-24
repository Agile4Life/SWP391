package com.swp391.scms.auth.dto;

/**
 * Kết quả đăng nhập: JWT, tên đăng nhập, vai trò và họ tên.
 *
 * {@code fullName} là tên hiển thị của người dùng (không bao giờ là định danh đăng nhập); có thể null với các lời gọi cũ.
 */
public record AuthTokenResponse(String token, String username, String role, String fullName) {
    /** Constructor không có họ tên. */
    public AuthTokenResponse(String token, String username, String role) {
        this(token, username, role, null);
    }
}
