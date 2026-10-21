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
    @Test
    void rejectsAccessTokenIssuedToAnotherClientBeforeLoadingUserInfo() {
        var transport = new com.google.api.client.testing.http.MockHttpTransport.Builder()
                .setLowLevelHttpResponse(new com.google.api.client.testing.http.MockLowLevelHttpResponse()
                        .setContentType("application/json")
                        .setContent("{\"audience\":\"other-client\",\"issued_to\":\"other-client\",\"expires_in\":3600}"))
                .build();
        var verifier = new GoogleIdTokenVerifierAdapter("our-client", "secret", "http://localhost/callback", transport);
        assertThrows(UnauthorizedException.class, () -> verifier.verifyAccessToken("access-token"));
        org.junit.jupiter.api.Assertions.assertTrue(transport.getLowLevelHttpRequest().getUrl().contains("tokeninfo"));
    }

    @Test
    void rejectsAuthorizationCodeWithUnconfiguredRedirectBeforeNetworkRequest() {
        var verifier = new GoogleIdTokenVerifierAdapter("our-client", "secret", "http://localhost/callback");
        assertThrows(UnauthorizedException.class,
                () -> verifier.verifyAuthorizationCode("code", "https://attacker.example/callback"));
    }

    @Test
    void acceptsOnlyClientBoundUnexpiredAccessTokensWithMatchingSubject() {
        var transport = new com.google.api.client.http.HttpTransport() {
            @Override protected com.google.api.client.http.LowLevelHttpRequest buildRequest(String method, String url) {
                String body = url.contains("tokeninfo")
                        ? "{\"audience\":\"our-client\",\"issued_to\":\"our-client\",\"expires_in\":3600,\"user_id\":\"sub-1\"}"
                        : "{\"sub\":\"sub-1\",\"email\":\"user@gmail.com\",\"email_verified\":true}";
                return new com.google.api.client.testing.http.MockLowLevelHttpRequest(url).setResponse(
                        new com.google.api.client.testing.http.MockLowLevelHttpResponse().setContentType("application/json").setContent(body));
            }
        };
        var verifier = new GoogleIdTokenVerifierAdapter("our-client", "secret", "http://localhost/callback", transport);
        assertEquals("sub-1", verifier.verifyAccessToken("access-token").sub());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
        "{\"audience\":\"our-client\",\"issued_to\":\"other-client\",\"expires_in\":3600}",
        "{\"audience\":\"our-client\",\"issued_to\":\"our-client\",\"expires_in\":0}",
        "{\"audience\":\"our-client\",\"issued_to\":\"our-client\"}"
    })
    void rejectsWrongPresenterOrExpiredOrMissingExpiry(String metadata) {
        var transport = new com.google.api.client.testing.http.MockHttpTransport.Builder()
                .setLowLevelHttpResponse(new com.google.api.client.testing.http.MockLowLevelHttpResponse()
                        .setContentType("application/json").setContent(metadata)).build();
        var verifier = new GoogleIdTokenVerifierAdapter("our-client", "secret", "http://localhost/callback", transport);
        assertThrows(UnauthorizedException.class, () -> verifier.verifyAccessToken("access-token"));
    }

    @Test
    void providerErrorsDoNotExposeTokensOrSecrets() {
        var transport = new com.google.api.client.testing.http.MockHttpTransport.Builder()
                .setLowLevelHttpResponse(new com.google.api.client.testing.http.MockLowLevelHttpResponse()
                        .setStatusCode(400).setContentType("application/json")
                        .setContent("{\"error\":\"private-token-value\"}")).build();
        var verifier = new GoogleIdTokenVerifierAdapter("our-client", "secret", "http://localhost/callback", transport);
        var error = assertThrows(UnauthorizedException.class, () -> verifier.verifyAccessToken("private-token-value"));
        org.junit.jupiter.api.Assertions.assertNull(error.getDetails());
        org.junit.jupiter.api.Assertions.assertFalse(error.getMessage().contains("private-token-value"));
    }

}
