package com.swp391.scms.auth;

public interface GoogleTokenVerifier {
    GoogleTokenPayload verify(String idToken);
}
