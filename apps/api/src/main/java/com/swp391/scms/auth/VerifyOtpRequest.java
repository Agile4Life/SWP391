package com.swp391.scms.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request xác thực OTP kích hoạt: địa chỉ nhận (email/SĐT) và mã OTP. */
public record VerifyOtpRequest(
    @NotBlank(message = "{validation.auth.target.not_blank}") String target,
    @NotBlank(message = "{validation.auth.otp.not_blank}") @Size(min = 6, max = 6, message = "{validation.auth.otp.size}") String otpCode
) {}