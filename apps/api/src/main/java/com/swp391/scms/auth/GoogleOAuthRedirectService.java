package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleOAuthCallbackRequest;
import com.swp391.scms.auth.dto.AuthTokenResponse;
import com.swp391.scms.common.exception.UnauthorizedException;
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

/**
 * Luồng đăng nhập Google bằng chuyển hướng trang: dùng session chỉ để lưu state chống giả mạo (CSRF) trong vài
 * phút; sau khi xong, JWT được trao cho frontend qua một mã trao tay dùng một lần có bảo vệ PKCE (frontend gửi
 * verifier mà chỉ nó biết).
 *
 * Browser correlation for the redirect flow; application authentication remains JWT based.
 */
@Service
public class GoogleOAuthRedirectService {
    private static final String STATE_KEY = GoogleOAuthRedirectService.class.getName() + ".state";
    private static final Duration HANDOFF_TTL = Duration.ofSeconds(60);
    private final java.util.concurrent.ConcurrentMap<String, PendingLogin> handoffs = new java.util.concurrent.ConcurrentHashMap<>();
    private static final Duration STATE_TTL = Duration.ofMinutes(5);
    private final AuthService authService;
    private final MessageService messages;
    private final Clock clock;
    private final String clientId;
    private final String redirectUri;
    private final String webOrigin;
    private final boolean debugOtp;
    private final SecureRandom random = new SecureRandom();

    /** Đọc cấu hình Google (client id, redirect), địa chỉ frontend và cờ debug OTP. */
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

    /**
     * Bước 1: kiểm tra redirect và challenge PKCE, rồi chuyển sang /authorize/start trên host của callback.
     * Chưa cấu hình Google thì quay về trang đăng nhập báo "chưa cấu hình".
     */
    public URI entry(String requestedRedirect, String challenge) {
        validateRedirect(requestedRedirect);
        if (clientId.isBlank()) return login().queryParam("google_oauth", "not_configured").build().encode().toUri();
        validateChallenge(challenge);
        // Establish cookies on the callback host even when entry was accessed through a frontend proxy.
        return UriComponentsBuilder.fromUriString(redirectUri)
                .replacePath("/api/v1/auth/google/authorize/start").replaceQuery(null)
                .queryParam("code_challenge", challenge).build().toUri();
    }

    /**
     * Bước 2: sinh state ngẫu nhiên 32 byte, lưu vào session cùng challenge, rồi chuyển hướng sang trang đăng
     * nhập Google.
     */
    public URI authorize(HttpSession session, String challenge) {
        if (clientId.isBlank()) return entry(null, challenge);
        validateChallenge(challenge);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        session.setAttribute(STATE_KEY, new PendingState(state, clock.instant(), challenge));
        return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", clientId).queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code").queryParam("scope", "openid email profile")
                .queryParam("access_type", "online").queryParam("prompt", "select_account")
                .queryParam("state", state).build().encode().toUri();
    }

    /**
     * Bước 3 (Google gọi lại): state phải khớp và chưa quá 5 phút. Đăng nhập thành công thì về /login với mã
     * trao tay trong phần #fragment (không gửi lên server log); cần OTP thì về /login kèm email; lỗi thì về
     * /login kèm thông báo lỗi.
     */
    public URI complete(HttpSession session, String state, String code, String error, String requestedRedirect) {
        PendingState pendingState = consumeState(session, state);
        if (pendingState == null) return failure("auth.google.state_invalid");
        try {
            validateRedirect(requestedRedirect);
            if (error != null || code == null || code.isBlank()) return failure("auth.google.invalid_token");
            var challenge = authService.authenticateGoogle(new GoogleOAuthCallbackRequest(null, null, code, redirectUri));
            if (challenge.authentication() != null) {
                return login().queryParam("google_oauth", "authenticated")
                        .fragment("google_login_code=" + createHandoff(challenge.authentication(), pendingState.challenge())).build().encode().toUri();
            }
            var result = login().queryParam("google_oauth", "callback").queryParam("email", challenge.email())
                    .queryParam("message", message("auth.google.otp.sent", challenge.email()));
            if (debugOtp && challenge.otpCode() != null) result.queryParam("debug_otp", challenge.otpCode());
            return result.build().encode().toUri();
        } catch (AppException ex) {
            return failure(ex.getMessageKey() == null ? "auth.google.invalid_token" : ex.getMessageKey(),
                    ex.getMessageArgs() == null ? new Object[0] : ex.getMessageArgs());
        }
    }

    /** Tạo mã trao tay ngẫu nhiên, lưu kèm JWT và challenge trong bộ nhớ 60 giây; dọn các mã đã hết hạn. */
    private String createHandoff(AuthTokenResponse authentication, String challenge) {
        Instant now = clock.instant();
        handoffs.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        handoffs.put(code, new PendingLogin(authentication, now.plus(HANDOFF_TTL), challenge));
        return code;
    }

    /**
     * Đổi mã trao tay lấy JWT: mã chỉ dùng được một lần, còn hạn, và SHA-256 của verifier phải khớp challenge
     * (so sánh thời gian hằng để chống đoán).
     */
    public AuthTokenResponse redeem(String code, String verifier) {
        PendingLogin login = code == null ? null : handoffs.remove(code);
        if (login == null || !login.expiresAt().isAfter(clock.instant()) || verifier == null
                || !verifier.matches("[A-Za-z0-9_-]{43}")
                || !MessageDigest.isEqual(login.challenge().getBytes(StandardCharsets.US_ASCII),
                        hashVerifier(verifier).getBytes(StandardCharsets.US_ASCII))) {
            throw new UnauthorizedException("INVALID_GOOGLE_HANDOFF", "auth.google.handoff_invalid", null, null);
        }
        return login.authentication();
    }

    /** Phiên đăng nhập chờ trao tay: JWT, thời điểm hết hạn và challenge PKCE. */
    private record PendingLogin(AuthTokenResponse authentication, Instant expiresAt, String challenge) { }

    /** Challenge PKCE phải là chuỗi base64url dài 43 ký tự. */
    private void validateChallenge(String challenge) {
        if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) {
            throw new BadRequestException("INVALID_GOOGLE_CHALLENGE", "auth.google.handoff_invalid", null, null);
        }
    }

    /** Tính SHA-256 của verifier rồi mã hóa base64url (theo chuẩn PKCE S256). */
    private String hashVerifier(String verifier) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    /** Lấy và xóa state trong session (dùng một lần); chỉ hợp lệ khi khớp giá trị gửi về và chưa quá 5 phút. */
    private PendingState consumeState(HttpSession session, String supplied) {
        if (session == null) return null;
        synchronized (session) {
            Object stored = session.getAttribute(STATE_KEY);
            session.removeAttribute(STATE_KEY);
            if (!(stored instanceof PendingState pending) || supplied == null) return null;
            Duration age = Duration.between(pending.createdAt(), clock.instant());
            return !age.isNegative() && age.compareTo(STATE_TTL) < 0
                    && MessageDigest.isEqual(pending.value().getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8)) ? pending : null;
        }
    }

    /** Địa chỉ redirect (nếu có) phải đúng địa chỉ callback đã cấu hình. */
    private void validateRedirect(String requested) {
        if (requested != null && !requested.equals(redirectUri)) {
            throw new BadRequestException("INVALID_GOOGLE_REDIRECT", "auth.google.redirect_invalid", null, null);
        }
    }

    /** Đường dẫn trang /login của frontend. */
    private UriComponentsBuilder login() { return UriComponentsBuilder.fromUriString(webOrigin + "/login"); }
    /** Địa chỉ quay về /login báo lỗi với thông báo đã dịch. */
    private URI failure(String key, Object... args) {
        return login().queryParam("google_oauth", "error").queryParam("error", message(key, args)).build().encode().toUri();
    }
    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String message(String key, Object... args) { return messages == null ? key : messages.getMessage(key, args); }
    /** State chống giả mạo lưu trong session: giá trị, thời điểm tạo và challenge PKCE. */
    private record PendingState(String value, Instant createdAt, String challenge) implements java.io.Serializable { }
}
