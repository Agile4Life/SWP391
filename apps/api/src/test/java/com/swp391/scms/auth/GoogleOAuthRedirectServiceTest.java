package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleOAuthOtpChallenge;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GoogleOAuthRedirectServiceTest {
    private final AuthService auth = mock(AuthService.class);
    private static final Instant NOW = Instant.parse("2026-10-21T12:00:00Z");
    private GoogleOAuthRedirectService service(Instant now, boolean debug) {
        return new GoogleOAuthRedirectService(auth, null, Clock.fixed(now, ZoneOffset.UTC), "client",
                "https://api.example.com/api/v1/auth/google/callback", "https://web.example.com", debug);
    }
    private String state(GoogleOAuthRedirectService service, MockHttpSession session) {
        return UriComponentsBuilder.fromUri(service.authorize(session)).build().getQueryParams().getFirst("state");
    }
    @Test void canonicalHopEstablishesCookieOnCallbackHost() {
        assertEquals("https://api.example.com/api/v1/auth/google/authorize/start", service(NOW, false).entry(null).toString());
    }
    @Test void rejectsWrongBrowserAndReplayWithoutExchangingCode() {
        var service = service(NOW, false);
        var browser = new MockHttpSession();
        String state = state(service, browser);
        assertTrue(service.complete(new MockHttpSession(), state, "code", null, null).toString().contains("google_oauth=error"));
        when(auth.requestGoogleOAuthOtp(any())).thenReturn(new GoogleOAuthOtpChallenge("user@gmail.com", "123456"));
        String result = service.complete(browser, state, "code", null, null).toString();
        assertTrue(result.contains("google_oauth=callback"));
        assertFalse(result.contains("123456"));
        assertTrue(service.complete(browser, state, "code", null, null).toString().contains("google_oauth=error"));
        verify(auth, times(1)).requestGoogleOAuthOtp(argThat(r -> r.redirectUri().equals("https://api.example.com/api/v1/auth/google/callback")));
    }
    @Test void rejectsExpiredAndMismatchedState() {
        var browser = new MockHttpSession();
        String state = state(service(NOW, false), browser);
        assertTrue(service(NOW.plusSeconds(300), false).complete(browser, state, "code", null, null).toString().contains("google_oauth=error"));
        state(service(NOW, false), browser);
        assertTrue(service(NOW, false).complete(browser, "wrong-state", "code", null, null).toString().contains("google_oauth=error"));
        verifyNoInteractions(auth);
    }
    @Test void cancellationConsumesStateAndDebugUsesFrontendParameter() {
        var service = service(NOW, true);
        var browser = new MockHttpSession();
        String state = state(service, browser);
        assertTrue(service.complete(browser, state, null, "access_denied", null).toString().contains("google_oauth=error"));
        assertTrue(service.complete(browser, state, "code", null, null).toString().contains("google_oauth=error"));
        verifyNoInteractions(auth);
        state = state(service, browser);
        when(auth.requestGoogleOAuthOtp(any())).thenReturn(new GoogleOAuthOtpChallenge("user@gmail.com", "123456"));
        assertTrue(service.complete(browser, state, "code", null, null).toString().contains("debug_otp=123456"));
    }
    @Test void callbackCannotOverrideConfiguredRedirect() {
        var service = service(NOW, false);
        var browser = new MockHttpSession();
        String state = state(service, browser);
        assertTrue(service.complete(browser, state, "code", null, "https://attacker.example").toString().contains("google_oauth=error"));
        verifyNoInteractions(auth);
    }
}
