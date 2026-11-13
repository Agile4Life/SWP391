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
        when(service.getMySessions(10L, "MEMBER")).thenReturn(List.of());
        assertNotNull(controller.getMySessions(principal));
        verify(service).getMySessions(10L, "MEMBER");
    }

    @Test void allowsReceptionistToAskTheAssistant() {
        var receptionist = new AuthenticatedPrincipal(30L, "desk", "RECEPTIONIST");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(receptionist, null,
                List.of(new SimpleGrantedAuthority("ROLE_RECEPTIONIST"))));
        when(service.getMySessions(30L, "RECEPTIONIST")).thenReturn(List.of());
        assertNotNull(controller.getMySessions(receptionist));
        verify(service).getMySessions(30L, "RECEPTIONIST");
    }

    /** Coaches use the AI only for workout plan suggestions, not the chat. */
    @Test void rejectsCoach() {
        var coach = new AuthenticatedPrincipal(20L, "coach", "COACH");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(coach, null,
                List.of(new SimpleGrantedAuthority("ROLE_COACH"))));
        assertThrows(AccessDeniedException.class, () -> controller.getMySessions(coach));
        assertThrows(AccessDeniedException.class, () -> controller.sendQuickMessage(
                new com.swp391.scms.ai.dto.AiChatMessageCreateDto("Xin chào"), coach));
        verifyNoInteractions(service);
    }
}
