package com.swp391.scms.auth.dto;

/** Internal result; raw OTP is only exposed through debug-only response mapping. Never audit this result. */
public record GoogleOAuthResult(String email, String otpCode, AuthTokenResponse authentication) {
    public GoogleOAuthResult(String email, String otpCode) {
        this(email, otpCode, null);
    }
}
