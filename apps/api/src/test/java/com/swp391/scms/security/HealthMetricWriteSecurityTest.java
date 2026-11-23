package com.swp391.scms.security;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.health.HealthMetricController;
import com.swp391.scms.health.HealthMetricService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthMetricController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class HealthMetricWriteSecurityTest {

    @Autowired MockMvc mvc;
    @MockitoBean HealthMetricService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(20L, "test-member", role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    @Test
    void healthMetricControllerIsDisabledByDefault() throws Exception {
        ConditionalOnProperty condition = HealthMetricController.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(condition).isNotNull();
        assertThat(condition.havingValue()).isEqualTo("true");
        assertThat(condition.matchIfMissing()).isFalse();

        mvc.perform(get("/api/v1/health/metrics/my").with(authentication(actor("MEMBER"))))
                .andExpect(status().isNotFound());
        verifyNoInteractions(service);
    }
}
