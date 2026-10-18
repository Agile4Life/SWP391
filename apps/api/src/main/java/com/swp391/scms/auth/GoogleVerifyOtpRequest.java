package com.swp391.scms.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleVerifyOtpRequest(
    @NotBlank(message = "{validation.auth.email.not_blank}")
    @Email(message = "{validation.auth.email.invalid}")
    String email,
    @NotBlank(message = "{validation.auth.otp.not_blank}")
    @Size(min = 6, max = 6, message = "{validation.auth.otp.size}")
    String otpCode
) {}

