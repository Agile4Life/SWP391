package com.swp391.scms.support;

import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.support.dto.SupportReadResultDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(SupportInboxControllerTest.Config.class)
class SupportInboxControllerTest {
    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean SupportRequestService support() { return mock(SupportRequestService.class); }
        @Bean SupportInboxService inbox() { return mock(SupportInboxService.class); }
        @Bean SupportRequestController controller(SupportRequestService support, SupportInboxService inbox) {
            return new SupportRequestController(support, null, inbox);
        }
    }

    @Autowired SupportRequestController controller;
    @Autowired SupportInboxService inbox;
    @Autowired SupportRequestService support;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver(),
                        new PageableHandlerMethodArgumentResolver()).build();
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        reset(inbox, support);
    }

    void login(String role) {
        var principal = new AuthenticatedPrincipal(2L, "unit", role);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test
    void validReadReturnsRemainingUnreadCount() throws Exception {
        login("RECEPTIONIST");
        when(inbox.markRead(1L, 2L, "RECEPTIONIST", 5L)).thenReturn(new SupportReadResultDto(2));
        mvc.perform(post("/api/v1/support/requests/1/read").contentType("application/json")
                .content("{\"lastMessageId\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.unreadCount").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"lastMessageId\":null}", "{\"lastMessageId\":-1}"})
    void invalidCursorIsRejectedBeforeService(String body) throws Exception {
        login("RECEPTIONIST");
        mvc.perform(post("/api/v1/support/requests/1/read").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(inbox);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "CENTER_MANAGER", "COACH"})
    void otherRolesCannotMarkRead(String role) throws Exception {
        login(role);
        mvc.perform(post("/api/v1/support/requests/1/read").contentType("application/json")
                .content("{\"lastMessageId\":0}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(inbox);
    }

    @Test
    void inboxCombinesStatusAndUnreadWithoutMarkingRead() throws Exception {
        login("RECEPTIONIST");
        when(inbox.inbox(eq(2L), eq("RECEPTIONIST"), eq("open"), eq(true), any()))
                .thenReturn(Page.empty(org.springframework.data.domain.PageRequest.of(2, 20)));
        mvc.perform(get("/api/v1/support/requests?status=open&unreadOnly=true&page=2"))
                .andExpect(status().isOk());
        verify(inbox).inbox(eq(2L), eq("RECEPTIONIST"), eq("open"), eq(true), argThat(p -> p.getPageNumber() == 2));
        verify(inbox, never()).markRead(any(), any(), any(), any());
        verifyNoInteractions(support);
    }

    @Test
    void managerKeepsExistingListing() throws Exception {
        login("CENTER_MANAGER");
        when(support.getAllRequests(eq("open"), any(), eq("CENTER_MANAGER")))
                .thenReturn(Page.empty(org.springframework.data.domain.PageRequest.of(0, 20)));
        mvc.perform(get("/api/v1/support/requests?status=open&unreadOnly=true"))
                .andExpect(status().isOk());
        verifyNoInteractions(inbox);
    }
}
