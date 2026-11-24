package com.swp391.scms.auth.dto;

/** Kết quả đăng ký: thông báo, id và tên đăng nhập của tài khoản mới. */
public record RegistrationResponse(String message, Long userId, String username) {}
