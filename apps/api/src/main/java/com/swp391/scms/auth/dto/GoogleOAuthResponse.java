package com.swp391.scms.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Kết quả gọi Google: cần OTP hay đã đăng nhập, email, JWT (nếu có), thông báo, số phút hiệu lực OTP và mã OTP
 * debug (chỉ ở dev).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GoogleOAuthResponse(boolean requiresOtp, String email, AuthTokenResponse authentication,
                                  String message, Integer expiresInMinutes, String debugOtp) { }
