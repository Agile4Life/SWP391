package com.swp391.scms.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Request chỉ chứa email: dùng cho gửi OTP Google và gửi OTP quên mật khẩu. */
public record GoogleOtpRequest(
    @NotBlank(message = "{validation.auth.email.not_blank}")
    @Email(message = "{validation.auth.email.invalid}")
    String email
) {}

