package com.swp391.scms.auth.dto;

/**
 * Kết quả nội bộ của xác thực Google: email, mã OTP vừa gửi (nếu cần) và JWT (nếu đã đăng nhập ngay).
 *
 * Kết quả nội bộ; OTP thô chỉ lộ qua ánh xạ phản hồi chỉ dành cho debug. Không bao giờ audit kết quả này.
 */
public record GoogleOAuthResult(String email, String otpCode, AuthTokenResponse authentication) {
    /** Kết quả khi cần OTP (chưa có JWT). */
    public GoogleOAuthResult(String email, String otpCode) {
        this(email, otpCode, null);
    }
}
