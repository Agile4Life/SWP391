package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleUserInfo;

/**
 * Port interface for verifying Google ID Tokens.
 * Follows Hexagonal / IoC Architecture to allow clean unit testing and mock verification.
 */
public interface GoogleTokenVerifierPort {
    GoogleUserInfo verify(String idToken);
}
