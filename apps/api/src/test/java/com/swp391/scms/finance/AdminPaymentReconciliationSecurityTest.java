package com.swp391.scms.finance;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.controller.AdminPaymentReconciliationController;
import com.swp391.scms.finance.dto.ReconciliationDtos.*;
import com.swp391.scms.finance.service.PaymentReconciliationService;
import com.swp391.scms.security.*;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminPaymentReconciliationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class AdminPaymentReconciliationSecurityTest {
    private static final String BASE = "/api/v1/admin/payments/reconciliation";
    private static final List<String> PATHS = List.of("/summary", "/attempts", "/late-refunds", "/ipn-events", "/payments/1/timeline");

    @Autowired MockMvc mvc;
    @MockBean PaymentReconciliationService service;
    @MockBean JwtService jwt;
    @MockBean UserRepository users;
    @MockBean MessageService messages;

    @Test
    void anonymousIsRejected() throws Exception {
        for (String path : PATHS) mvc.perform(get(BASE + path)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COACH", "RECEPTIONIST", "CENTER_MANAGER"})
    void nonAdminRolesAreForbidden(String role) throws Exception {
        for (String path : PATHS) {
            mvc.perform(get(BASE + path).with(user("u").roles(role))).andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminReadsEveryView() throws Exception {
        when(service.summary(any(), any())).thenReturn(new ReconciliationSummaryDto(LocalDate.of(2026, 11, 7),
                LocalDate.of(2026, 11, 13), 1, 2, 3, new BigDecimal("450000"), 4, 5, 6, new AnomalyCounts(0, 0, 0)));
        when(service.attempts(any(), any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(new PageImpl<>(List.of()));
        when(service.lateRefunds(any(), any(), anyInt(), anyInt())).thenReturn(new PageImpl<>(List.of()));
        when(service.ipnEvents(any(), any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(new PageImpl<>(List.of()));
        when(service.timeline(1L)).thenReturn(new PaymentTimelineDto(null, List.of(), List.of(), List.of(), List.of()));

        mvc.perform(get(BASE + "/summary").param("from", "2026-11-07").param("to", "2026-11-13"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.staleAttempts").value(1))
                .andExpect(jsonPath("$.data.lateRefundAmount").value(450000));
        verify(service).summary(LocalDate.of(2026, 11, 7), LocalDate.of(2026, 11, 13));
        mvc.perform(get(BASE + "/attempts").param("status", "pending").param("stale", "true").param("q", "abc")
                .param("page", "2").param("size", "50")).andExpect(status().isOk());
        verify(service).attempts("pending", true, "abc", null, null, 2, 50);
        mvc.perform(get(BASE + "/late-refunds")).andExpect(status().isOk());
        mvc.perform(get(BASE + "/ipn-events").param("rspCode", "99").param("source", "IPN"))
                .andExpect(status().isOk());
        verify(service).ipnEvents("99", "IPN", null, null, null, 0, 20);
        mvc.perform(get(BASE + "/payments/1/timeline")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void unknownPaymentTimelineIsNotFound() throws Exception {
        when(service.timeline(404L)).thenThrow(new ResourceNotFoundException("PAYMENT_NOT_FOUND",
                "error.reconciliation.payment_not_found", new Object[]{404L}, "missing"));
        mvc.perform(get(BASE + "/payments/404/timeline")).andExpect(status().isNotFound());
    }
}
