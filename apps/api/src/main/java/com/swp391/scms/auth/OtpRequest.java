package com.swp391.scms.auth;

/** Request gửi OTP: email hoặc số điện thoại. */
public record OtpRequest(String email, String phoneNumber) {
    /** Địa chỉ nhận OTP: ưu tiên email, không có thì dùng số điện thoại. */
    public String target() {
        return (email != null && !email.isBlank()) ? email.trim() : phoneNumber;
    }
}