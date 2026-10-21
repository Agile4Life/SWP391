package com.swp391.scms.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;

/**
 * Google credentials. HTTP popup requests accept tokens only; the state-validated redirect service uses code/redirectUri internally.
 */
public record GoogleOAuthCallbackRequest(
        String idToken,
        String accessToken,
        String code,
        String redirectUri
) {
    @JsonIgnore
    @AssertTrue(message = "{auth.google.invalid_token}")
    public boolean isPopupCredential() {
        return code == null && redirectUri == null
                && ((idToken != null && !idToken.isBlank()) || (accessToken != null && !accessToken.isBlank()));
    }

    public GoogleOAuthCallbackRequest(String idToken) {
        this(idToken, null, null, null);
    }
}
