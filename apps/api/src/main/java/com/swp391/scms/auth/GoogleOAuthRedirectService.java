package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/** Browser correlation for the redirect flow; application authentication remains JWT based. */
@Service
public class GoogleOAuthRedirectService {
    private static final String STATE_KEY = GoogleOAuthRedirectService.class.getName() + ".state";
    private static final Duration STATE_TTL = Duration.ofMinutes(5);
    private final AuthService authService;
    private final MessageService messages;
    private final Clock clock;
    private final String clientId;
    private final String redirectUri;
    private final String webOrigin;
    private final boolean debugOtp;
    private final SecureRandom random = new SecureRandom();

    public GoogleOAuthRedirectService(AuthService authService, MessageService messages, Clock clock,
            @Value("${app.google.client-id:}") String clientId,
            @Value("${app.google.redirect-uri:http://localhost:8080/api/v1/auth/google/callback}") String redirectUri,
            @Value("${app.cors.web-origin:http://localhost:5173}") String webOrigin,
            @Value("${app.auth.debug-otp-enabled:false}") boolean debugOtp) {
        this.authService = authService;
        this.messages = messages;
        this.clock = clock;
        this.clientId = clientId.trim();
        this.redirectUri = redirectUri.trim();
        this.webOrigin = webOrigin.replaceAll("/+$", "");
        this.debugOtp = debugOtp;
    }

    public URI entry(String requestedRedirect) {
        validateRedirect(requestedRedirect);
        if (clientId.isBlank()) return login().queryParam("google_oauth", "not_configured").build().encode().toUri();
        // Establish cookies on the callback host even when entry was accessed through a frontend proxy.
        return UriComponentsBuilder.fromUriString(redirectUri)
                .replacePath("/api/v1/auth/google/authorize/start").replaceQuery(null).build().toUri();
    }

    public URI authorize(HttpSession session) {
        if (clientId.isBlank()) return entry(null);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        session.setAttribute(STATE_KEY, new PendingState(state, clock.instant()));
        return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", clientId).queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code").queryParam("scope", "openid email profile")
                .queryParam("access_type", "online").queryParam("prompt", "select_account")
                .queryParam("state", state).build().encode().toUri();
    }

    public URI complete(HttpSession session, String state, String code, String error, String requestedRedirect) {
        if (!consumeState(session, state)) return failure("auth.google.state_invalid");
        try {
            validateRedirect(requestedRedirect);
            if (error != null || code == null || code.isBlank()) return failure("auth.google.invalid_token");
            var challenge = authService.requestGoogleOAuthOtp(new GoogleOAuthCallbackRequest(null, null, code, redirectUri));
            var result = login().queryParam("google_oauth", "callback").queryParam("email", challenge.email())
                    .queryParam("message", message("auth.google.otp.sent", challenge.email()));
            if (debugOtp && challenge.otpCode() != null) result.queryParam("debug_otp", challenge.otpCode());
            return result.build().encode().toUri();
        } catch (AppException ex) {
            return failure(ex.getMessageKey() == null ? "auth.google.invalid_token" : ex.getMessageKey(),
                    ex.getMessageArgs() == null ? new Object[0] : ex.getMessageArgs());
        }
    }

    private boolean consumeState(HttpSession session, String supplied) {
        if (session == null) return false;
        synchronized (session) {
            Object stored = session.getAttribute(STATE_KEY);
            session.removeAttribute(STATE_KEY);
            if (!(stored instanceof PendingState pending) || supplied == null) return false;
            Duration age = Duration.between(pending.createdAt(), clock.instant());
            return !age.isNegative() && age.compareTo(STATE_TTL) < 0
                    && MessageDigest.isEqual(pending.value().getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
        }
    }

    private void validateRedirect(String requested) {
        if (requested != null && !requested.equals(redirectUri)) {
            throw new BadRequestException("INVALID_GOOGLE_REDIRECT", "auth.google.redirect_invalid", null, null);
        }
    }

    private UriComponentsBuilder login() { return UriComponentsBuilder.fromUriString(webOrigin + "/login"); }
    private URI failure(String key, Object... args) {
        return login().queryParam("google_oauth", "error").queryParam("error", message(key, args)).build().encode().toUri();
    }
    private String message(String key, Object... args) { return messages == null ? key : messages.getMessage(key, args); }
    private record PendingState(String value, Instant createdAt) implements java.io.Serializable { }
}
