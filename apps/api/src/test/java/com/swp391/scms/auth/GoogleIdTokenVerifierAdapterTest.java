package com.swp391.scms.auth;

import com.swp391.scms.common.exception.UnauthorizedException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;

class GoogleIdTokenVerifierAdapterTest {
    @Test
    void rejectsGoogleLoginWhenClientIdIsNotConfigured() {
        var verifier = new GoogleIdTokenVerifierAdapter("");
        var error = assertThrows(UnauthorizedException.class, () -> verifier.verify("unused-token"));
        assertEquals("GOOGLE_LOGIN_NOT_CONFIGURED", error.getErrorCode());
    }
}
