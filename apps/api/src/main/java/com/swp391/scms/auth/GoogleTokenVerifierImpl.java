package com.swp391.scms.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;

@Component
public class GoogleTokenVerifierImpl implements GoogleTokenVerifier {

    private final String clientId;

    public GoogleTokenVerifierImpl(@Value("${app.google.client-id:${GOOGLE_CLIENT_ID:}}") String clientId) {
        this.clientId = clientId != null ? clientId.trim() : "";
    }

    @Override
    public GoogleTokenPayload verify(String idTokenString) {
        if (idTokenString == null || idTokenString.isBlank()) {
            return null;
        }
        try {
            GoogleIdTokenVerifier.Builder builder = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            );

            if (!clientId.isEmpty()) {
                builder.setAudience(Collections.singletonList(clientId));
            }

            GoogleIdTokenVerifier verifier = builder.build();
            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                return null;
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String sub = payload.getSubject();
            String email = payload.getEmail();
            boolean emailVerified = Boolean.TRUE.equals(payload.getEmailVerified());
            String name = (String) payload.get("name");
            String picture = (String) payload.get("picture");

            return new GoogleTokenPayload(sub, email, emailVerified, name, picture);
        } catch (Exception e) {
            return null;
        }
    }
}
