package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleUserInfo;

/**
 * Port interface for verifying Google ID Tokens, Access Tokens, and Authorization Codes.
 * Follows Hexagonal / IoC Architecture to allow clean unit testing and mock verification.
 */
public interface GoogleTokenVerifierPort {
    GoogleUserInfo verify(String idToken);

    default GoogleUserInfo verifyAccessToken(String accessToken) {
        throw new UnsupportedOperationException("Access token verification is not configured");
    }

    default GoogleUserInfo verifyAuthorizationCode(String code, String redirectUri) {
        throw new UnsupportedOperationException("Authorization code verification is not configured");
    }
}
