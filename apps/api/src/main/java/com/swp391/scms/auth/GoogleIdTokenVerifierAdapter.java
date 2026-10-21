package com.swp391.scms.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpResponse;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.GenericJson;
import com.google.api.client.json.JsonObjectParser;
import com.google.api.client.json.gson.GsonFactory;
import com.swp391.scms.auth.dto.GoogleUserInfo;
import com.swp391.scms.common.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

/**
 * Adapter implementing Google ID Token, OAuth2 Access Token, and OAuth2 Authorization Code verification
 * per BR-01 using Google API Client.
 */
@Component
public class GoogleIdTokenVerifierAdapter implements GoogleTokenVerifierPort {

    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    private final String clientId;
    private final String clientSecret;
    private final String defaultRedirectUri;
    private final HttpTransport transport;
    private final GsonFactory jsonFactory;
    private final GoogleIdTokenVerifier verifier;

    public GoogleIdTokenVerifierAdapter(String clientId) {
        this(clientId, "", "http://localhost:8080/api/v1/auth/google/callback");
    }

    @Autowired
    public GoogleIdTokenVerifierAdapter(
            @Value("${app.google.client-id:${GOOGLE_CLIENT_ID:}}") String clientId,
            @Value("${app.google.client-secret:${GOOGLE_CLIENT_SECRET:}}") String clientSecret,
            @Value("${app.google.redirect-uri:${GOOGLE_REDIRECT_URI:http://localhost:8080/api/v1/auth/google/callback}}") String defaultRedirectUri) {
        this(clientId, clientSecret, defaultRedirectUri, new NetHttpTransport());
    }

    GoogleIdTokenVerifierAdapter(String clientId, String clientSecret, String defaultRedirectUri, HttpTransport transport) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.defaultRedirectUri = defaultRedirectUri;
        this.transport = transport;
        this.jsonFactory = GsonFactory.getDefaultInstance();
        GoogleIdTokenVerifier.Builder builder = new GoogleIdTokenVerifier.Builder(
                this.transport,
                this.jsonFactory
        );
        if (clientId != null && !clientId.isBlank()) {
            builder.setAudience(Collections.singletonList(clientId.trim()));
        }
        builder.setIssuers(List.of("accounts.google.com", "https://accounts.google.com"));
        this.verifier = builder.build();
    }

    @Override
    public GoogleUserInfo verify(String idTokenString) {
        if (clientId == null || clientId.isBlank()) {
            throw new UnauthorizedException("GOOGLE_LOGIN_NOT_CONFIGURED", "auth.google.not_configured", null, null);
        }
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
                    (String) payload.get("picture"),
                    (String) payload.get("hd")
            );
        } catch (UnauthorizedException ue) {
            throw ue;
        } catch (Exception e) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
        }
    }

    @Override
    public GoogleUserInfo verifyAccessToken(String accessToken) {
        if (clientId == null || clientId.isBlank()) {
            throw new UnauthorizedException("GOOGLE_LOGIN_NOT_CONFIGURED", "auth.google.not_configured", null, null);
        }
        if (accessToken == null || accessToken.isBlank()) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google Access Token is missing");
        }
        try {
            GenericUrl tokenInfoUrl = new GenericUrl("https://www.googleapis.com/oauth2/v2/tokeninfo");
            tokenInfoUrl.set("access_token", accessToken.trim());
            GenericJson tokenInfo = fetchJson(tokenInfoUrl, null);
            if (tokenInfo == null || !clientId.trim().equals(tokenInfo.get("audience"))
                    || !clientId.trim().equals(tokenInfo.get("issued_to"))
                    || tokenInfo.get("expires_in") == null
                    || Double.parseDouble(tokenInfo.get("expires_in").toString()) <= 0) {
                throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
            }
            GenericJson payload = fetchJson(new GenericUrl(GOOGLE_USERINFO_URL), accessToken.trim());
            if (payload == null || payload.get("email") == null || payload.get("sub") == null
                    || (tokenInfo.get("user_id") != null && !tokenInfo.get("user_id").equals(payload.get("sub")))) {
                throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
            }
            Object emailVerifiedRaw = payload.get("email_verified");
            boolean emailVerified = Boolean.TRUE.equals(emailVerifiedRaw)
                    || "true".equalsIgnoreCase(String.valueOf(emailVerifiedRaw));
            return new GoogleUserInfo(
                    String.valueOf(payload.get("sub")),
                    String.valueOf(payload.get("email")),
                    emailVerified,
                    payload.get("name") != null ? String.valueOf(payload.get("name")) : null,
                    payload.get("picture") != null ? String.valueOf(payload.get("picture")) : null,
                    payload.get("hd") != null ? String.valueOf(payload.get("hd")) : null
            );
        } catch (UnauthorizedException ue) {
            throw ue;
        } catch (Exception e) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
        }
    }

    private GenericJson fetchJson(GenericUrl url, String bearer) throws java.io.IOException {
        HttpRequest request = transport.createRequestFactory(req -> {
            req.setParser(new JsonObjectParser(jsonFactory));
            req.setLoggingEnabled(false);
            req.setConnectTimeout(10000);
            req.setReadTimeout(10000);
            if (bearer != null) req.getHeaders().setAuthorization("Bearer " + bearer);
        }).buildGetRequest(url);
        HttpResponse response = request.execute();
        try {
            return response.parseAs(GenericJson.class);
        } finally {
            response.disconnect();
        }
    }

    @Override
    public GoogleUserInfo verifyAuthorizationCode(String code, String redirectUri) {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new UnauthorizedException("GOOGLE_LOGIN_NOT_CONFIGURED", "auth.google.not_configured", null, null);
        }
        if (code == null || code.isBlank()) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google authorization code is missing");
        }
        String targetRedirect = (redirectUri != null && !redirectUri.isBlank())
                ? redirectUri.trim()
                : defaultRedirectUri;
        if (!defaultRedirectUri.equals(targetRedirect)) {
            throw new UnauthorizedException("INVALID_GOOGLE_REDIRECT", "auth.google.redirect_invalid", null, null);
        }
        try {
            GoogleTokenResponse tokenResponse = new GoogleAuthorizationCodeTokenRequest(
                    transport,
                    jsonFactory,
                    GOOGLE_TOKEN_URL,
                    clientId.trim(),
                    clientSecret.trim(),
                    code.trim(),
                    targetRedirect
            ).execute();

            String idToken = tokenResponse.getIdToken();
            if (idToken != null && !idToken.isBlank()) {
                return verify(idToken);
            }
            String accessToken = tokenResponse.getAccessToken();
            if (accessToken != null && !accessToken.isBlank()) {
                return verifyAccessToken(accessToken);
            }
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, "Google token exchange returned no token");
        } catch (UnauthorizedException ue) {
            throw ue;
        } catch (Exception e) {
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "auth.google.invalid_token", null, null);
        }
    }
}
