package com.swp391.scms.auth;

/**
 * Mục đích sử dụng của mã OTP nhằm chặn việc tái sử dụng mã giữa các luồng xác thực khác nhau
 * (ví dụ: dùng mã kích hoạt tài khoản để đặt lại mật khẩu hoặc đăng nhập Google).
 */
public enum OtpPurpose {
    ACCOUNT_ACTIVATION,
    PASSWORD_RESET,
    GOOGLE_ACTIVATION
}
