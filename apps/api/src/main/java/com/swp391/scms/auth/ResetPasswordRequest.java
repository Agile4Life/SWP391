package com.swp391.scms.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request đặt lại mật khẩu: email, mã OTP và mật khẩu mới (theo PasswordPolicy). */
public record ResetPasswordRequest(
        @NotBlank(message = "{validation.auth.email.not_blank}")
        @Email(message = "{validation.auth.email.invalid}")
        String email,

        @NotBlank(message = "{validation.auth.otp.not_blank}")
        @Size(min = 6, max = 6, message = "{validation.auth.otp.size}")
        String otpCode,

        @NotBlank(message = "{validation.auth.password.not_blank}")
        @jakarta.validation.constraints.Pattern(regexp = com.swp391.scms.auth.PasswordPolicy.REGEX, message = "{validation.auth.password.policy}")
        String newPassword
) {
}
