package com.swp391.scms.chat;

import com.swp391.scms.chat.controller.ChatController;
import com.swp391.scms.chat.service.ChatService;
import com.swp391.scms.chat.dto.OpenChatConversation;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(ChatSecurityTest.Config.class)
class ChatSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean ChatService service() { return mock(ChatService.class); }
        @Bean ChatController controller(ChatService s) { return new ChatController(s); }
    }
    @Autowired ChatController controller;
    @Autowired ChatService service;
    @AfterEach void clear() { SecurityContextHolder.clearContext(); reset(service); }
    @Test void anonymousCannotRead() { assertThrows(AuthenticationCredentialsNotFoundException.class, () -> controller.list(null, 0)); }
    @ParameterizedTest @ValueSource(strings = {"CENTER_MANAGER", "GUEST"})
    void managerAndOtherRolesCannotRead(String role) {
        var p = login(role);
        assertThrows(AccessDeniedException.class, () -> controller.list(p, 0)); verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"MEMBER", "RECEPTIONIST", "COACH"})
    void supportedRoleCanReadOwnInbox(String role) {
        var p = login(role); controller.list(p, 0); verify(service).list(p, 0);
    }
    @Test void onlyMemberCanStartAChat() {
        var p = login("COACH");
        assertThrows(AccessDeniedException.class, () -> controller.open(p, new OpenChatConversation(10L)));
        verifyNoInteractions(service);
    }
    private AuthenticatedPrincipal login(String role) {
        var p = new AuthenticatedPrincipal(10L, "unit", role);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)))); return p;
    }
}
