package com.swp391.scms.auth.dto;

/**
 * Request payload when Google OAuth callbacks back to the application
 * (supports ID Token from GIS, Access Token from OAuth2 Popup, or Authorization Code from Redirect).
 */
public record GoogleOAuthCallbackRequest(
        String idToken,
        String accessToken,
        String code,
        String redirectUri
) {
    public GoogleOAuthCallbackRequest(String idToken) {
        this(idToken, null, null, null);
    }
}
