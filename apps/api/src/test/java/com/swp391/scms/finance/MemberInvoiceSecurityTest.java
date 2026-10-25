package com.swp391.scms.finance;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.finance.service.MemberInvoicePdfService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberInvoiceSecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class MethodSecurityOnly {}

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void downloadRejectsStaffButAcceptsMemberPrincipal() {
        MemberInvoicePdfService pdf = mock(MemberInvoicePdfService.class);
        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(MethodSecurityOnly.class);
            context.registerBean(MemberInvoiceController.class,
                    () -> new MemberInvoiceController(mock(InvoiceService.class), mock(MessageService.class), pdf));
            context.refresh();
            MemberInvoiceController controller = context.getBean(MemberInvoiceController.class);

            assertThrows(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class,
                    () -> controller.download(12L, new AuthenticatedPrincipal(7L, "test", "MEMBER")));
            verifyNoInteractions(pdf);

            authenticate(7L, "RECEPTIONIST");
            assertThrows(AccessDeniedException.class,
                    () -> controller.download(12L, new AuthenticatedPrincipal(7L, "staff", "RECEPTIONIST")));
            verifyNoInteractions(pdf);

            authenticate(7L, "MEMBER");
            when(pdf.download(12L, 7L)).thenReturn(new byte[]{37, 80, 68, 70});
            var response = controller.download(12L, new AuthenticatedPrincipal(7L, "member", "MEMBER"));
            assertNotNull(response.getBody());
            assertEquals(org.springframework.http.MediaType.APPLICATION_PDF, response.getHeaders().getContentType());
            assertTrue(response.getHeaders().getFirst(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION).contains("attachment"));
            verify(pdf).download(12L, 7L);
        }
    }

    private void authenticate(Long id, String role) {
        var auth = new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(id, "test", role), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
