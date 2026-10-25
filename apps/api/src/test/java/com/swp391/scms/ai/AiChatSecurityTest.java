package com.swp391.scms.ai;

import com.swp391.scms.ai.service.AiChatService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(AiChatSecurityTest.Config.class)
class AiChatSecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean AiChatService service() { return mock(AiChatService.class); }
        @Bean AiChatController controller(AiChatService service) { return new AiChatController(service); }
    }
    @Autowired AiChatController controller;
    @Autowired AiChatService service;
    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "unit-member", "MEMBER");

    @AfterEach void clear() { SecurityContextHolder.clearContext(); reset(service); }

    @Test void requiresAuthentication() {
        assertThrows(AuthenticationCredentialsNotFoundException.class, () -> controller.getMySessions(principal));
    }

    @Test void rejectsUnsupportedRole() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_GUEST"))));
        assertThrows(AccessDeniedException.class, () -> controller.getMySessions(principal));
        verifyNoInteractions(service);
    }

    @Test void allowsAuthenticatedMember() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))));
        when(service.getMySessions(10L)).thenReturn(List.of());
        assertNotNull(controller.getMySessions(principal));
        verify(service).getMySessions(10L);
    }
}
