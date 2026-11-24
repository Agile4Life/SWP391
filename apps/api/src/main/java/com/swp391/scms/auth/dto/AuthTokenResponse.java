package com.swp391.scms.auth.dto;

/**
 * Kết quả đăng nhập: JWT, tên đăng nhập, vai trò và họ tên.
 *
 * {@code fullName} is the person's display name (never the login identifier); null for legacy callers.
 */
public record AuthTokenResponse(String token, String username, String role, String fullName) {
    /** Constructor không có họ tên. */
    public AuthTokenResponse(String token, String username, String role) {
        this(token, username, role, null);
    }
}
