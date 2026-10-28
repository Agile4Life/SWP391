package com.swp391.scms.finance;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.finance.service.MemberInvoicePdfService;
import com.swp391.scms.security.*;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real JWT parsing and security filters with mocked persistence; never opens a database. */
@WebMvcTest(MemberInvoiceController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class, MemberInvoiceHttpSecurityTest.JwtConfig.class})
class MemberInvoiceHttpSecurityTest {
    @TestConfiguration
    static class JwtConfig {
        @Bean JwtService jwtService() {
            return new JwtService("invoice-unit-test-only-secret-with-at-least-32-bytes", 60000);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean InvoiceService invoices;
    @MockitoBean MemberInvoicePdfService pdf;
    @MockitoBean MessageService messages;

    private String token(String roleCode) {
        Role role = new Role(); role.setCode(roleCode);
        User user = new User(); user.setId(10L); user.setUsername("invoice-member");
        user.setStatus("active"); user.setRole(role);
        when(users.findWithRoleByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(user));
        return "Bearer " + jwt.generateToken(10L, user.getUsername(), roleCode);
    }

    @Test void memberJwtReachesOwnedInvoiceAndPdfWithoutFinance403() throws Exception {
        String bearer = token("MEMBER");
        InvoiceDto invoice = new InvoiceDto(); invoice.setTotalAmount(new BigDecimal("123456"));
        when(invoices.getMemberInvoiceByPaymentId(12L, 10L)).thenReturn(invoice);
        when(pdf.download(12L, 10L)).thenReturn(new byte[]{37, 80, 68, 70});
        mvc.perform(get("/api/v1/invoices/my/by-payment/12").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalAmount").value(123456));
        mvc.perform(get("/api/v1/invoices/my/by-payment/12/download").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
        verify(invoices).getMemberInvoiceByPaymentId(12L, 10L);
        verify(pdf).download(12L, 10L);
    }

    @Test void anonymousInvalidJwtAndDeletedUserCannotReadEitherEndpoint() throws Exception {
        for (String path : new String[]{"/api/v1/invoices/my/by-payment/12", "/api/v1/invoices/my/by-payment/12/download"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, "Bearer invalid"))
                    .andExpect(status().isUnauthorized());
            String bearer = token("MEMBER");
            when(users.findWithRoleByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.empty());
            mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer)).andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(invoices, pdf);
    }

    @Test void staffJwtCannotUseMemberInvoiceEndpoints() throws Exception {
        String bearer = token("RECEPTIONIST");
        mvc.perform(get("/api/v1/invoices/my/by-payment/12").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/invoices/my/by-payment/12/download").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isForbidden());
        verifyNoInteractions(invoices, pdf);
    }

    @Test void ownershipNotFoundIsPreservedAfterMemberAuthentication() throws Exception {
        String bearer = token("MEMBER");
        when(invoices.getMemberInvoiceByPaymentId(99L, 10L))
                .thenThrow(new ResourceNotFoundException("resource.invoice_for_payment", 99L));
        mvc.perform(get("/api/v1/invoices/my/by-payment/99").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isNotFound());
    }
}
