package com.swp391.scms.auth.dto;

/**
 * Result of verifying a Google OAuth callback and dispatching an OTP verification code to the user's Gmail.
 */
public record GoogleOAuthOtpChallenge(
        String email,
        String otpCode
) {
}
