package com.swp391.scms.security;

import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.dto.AuthenticationUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    private final UserRepository users = mock(UserRepository.class);
    private final JwtService jwt = new JwtService("test-only-signing-secret-with-at-least-32-bytes", 60000L);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void request(String token) throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/v1/check-in/history");
        request.addHeader("Authorization", "Bearer " + token);
        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
    }

    @Test
    void authenticatesFromScalarAccountStateWithoutLoadingUserProfiles() throws Exception {
        when(users.findAuthenticationById(10L)).thenReturn(Optional.of(new AuthenticationUser(10L, "staff", "active", "RECEPTIONIST")));
        request(jwt.generateToken(10L, "old-name", "MEMBER"));
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertEquals(new AuthenticatedPrincipal(10L, "staff", "RECEPTIONIST"), authentication.getPrincipal());
        assertTrue(authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_RECEPTIONIST")));
        verify(users).findAuthenticationById(10L);
        verifyNoMoreInteractions(users);
    }

    @ParameterizedTest
    @ValueSource(strings = {"locked", "inactive"})
    void refusesAccountsThatAreNoLongerActive(String status) throws Exception {
        when(users.findAuthenticationById(10L)).thenReturn(Optional.of(new AuthenticationUser(10L, "member", status, "MEMBER")));
        request(jwt.generateToken(10L, "member", "MEMBER"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void refusesMissingOrSoftDeletedAccounts() throws Exception {
        when(users.findAuthenticationById(10L)).thenReturn(Optional.empty());
        request(jwt.generateToken(10L, "member", "MEMBER"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void checksCurrentAccountStateAgainForTheNextRequest() throws Exception {
        when(users.findAuthenticationById(10L))
                .thenReturn(Optional.of(new AuthenticationUser(10L, "member", "active", "MEMBER")))
                .thenReturn(Optional.of(new AuthenticationUser(10L, "member", "locked", "MEMBER")));
        var token = jwt.generateToken(10L, "member", "MEMBER");
        request(token);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        SecurityContextHolder.clearContext();
        request(token);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void rejectsTokensSignedWithAnotherSecretBeforeAccessingTheDatabase() throws Exception {
        var otherSigner = new JwtService("another-test-signing-secret-with-at-least-32-bytes", 60000L);
        request(otherSigner.generateToken(10L, "member", "MEMBER"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(users);
    }
}
