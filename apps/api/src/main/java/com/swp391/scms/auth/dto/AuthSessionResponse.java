package com.swp391.scms.auth.dto;

/** Thông tin phiên hiện tại trả cho frontend: tên đăng nhập, vai trò và họ tên. */
public record AuthSessionResponse(String username, String role, String fullName) {
    /** Constructor không có họ tên. */
    public AuthSessionResponse(String username, String role) {
        this(username, role, null);
    }
}
