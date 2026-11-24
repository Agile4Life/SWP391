package com.swp391.scms.security;

/**
 * Thông tin người dùng đã đăng nhập được gắn vào SecurityContext sau khi kiểm tra JWT: id, tên đăng nhập và mã
 * vai trò (MEMBER, COACH, RECEPTIONIST, CENTER_MANAGER...). Controller nhận qua @AuthenticationPrincipal.
 */
public record AuthenticatedPrincipal(Long id, String username, String role) {}
