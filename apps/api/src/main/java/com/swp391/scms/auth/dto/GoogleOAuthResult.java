package com.swp391.scms.auth.dto;

/**
 * Kết quả nội bộ của xác thực Google: email, mã OTP vừa gửi (nếu cần) và JWT (nếu đã đăng nhập ngay).
 *
 * Internal result; raw OTP is only exposed through debug-only response mapping. Never audit this result.
 */
public record GoogleOAuthResult(String email, String otpCode, AuthTokenResponse authentication) {
    /** Kết quả khi cần OTP (chưa có JWT). */
    public GoogleOAuthResult(String email, String otpCode) {
        this(email, otpCode, null);
    }
}
