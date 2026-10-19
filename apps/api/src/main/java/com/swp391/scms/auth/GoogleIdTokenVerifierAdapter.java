package com.swp391.scms.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.swp391.scms.auth.dto.GoogleUserInfo;
import com.swp391.scms.common.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

/**
 * Adapter implementing Google ID Token verification per BR-01 using Google API Client.
 */
@Component
public class GoogleIdTokenVerifierAdapter implements GoogleTokenVerifierPort {

    private final String clientId;
    private final GoogleIdTokenVerifier verifier;

    public GoogleIdTokenVerifierAdapter(@Value("${app.google.client-id:${GOOGLE_CLIENT_ID:}}") String clientId) {
        this.clientId = clientId;
        GoogleIdTokenVerifier.Builder builder = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance()
        );
        if (clientId != null && !clientId.isBlank()) {
            builder.setAudience(Collections.singletonList(clientId.trim()));
        }
        builder.setIssuers(List.of("accounts.google.com", "https://accounts.google.com"));
        this.verifier = builder.build();
    }

    @Override
    public GoogleUserInfo verify(String idTokenString) {
        if (idTokenString == null || idTokenString.isBlank()) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google ID Token is missing");
        }
        try {
            GoogleIdToken idToken = verifier.verify(idTokenString.trim());
            if (idToken == null) {
                throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google ID Token signature, audience, or expiration is invalid");
            }
            GoogleIdToken.Payload payload = idToken.getPayload();
            return new GoogleUserInfo(
                    payload.getSubject(),
                    payload.getEmail(),
                    Boolean.TRUE.equals(payload.getEmailVerified()),
                    (String) payload.get("name"),
                    (String) payload.get("picture")
            );
        } catch (UnauthorizedException ue) {
            throw ue;
        } catch (Exception e) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Failed to verify Google ID Token: " + e.getMessage());
        }
    }
}
