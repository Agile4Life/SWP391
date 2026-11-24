package com.swp391.scms.security;

import com.swp391.scms.coaching.TrainingCompletionController;
import com.swp391.scms.coaching.TrainingPlanProgressController;
import com.swp391.scms.coaching.service.TrainingPlanProgressService;
import com.swp391.scms.common.i18n.MessageService;
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

/** Bộ kiểm thử cho TrainingPlanProgressSecurity (training plan progress security). */
@WebMvcTest(TrainingPlanProgressController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class TrainingPlanProgressSecurityTest {

    @Autowired MockMvc mvc;
    @MockitoBean TrainingPlanProgressService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (actor). */
    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(20L, "test-coach", role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    /** Kiểm thử: các controller tiến độ và hoàn thành mặc định bị tắt. */
    @Test
    void progressAndCompletionControllersAreDisabledByDefault() throws Exception {
        ConditionalOnProperty progressCondition = TrainingPlanProgressController.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(progressCondition).isNotNull();
        assertThat(progressCondition.havingValue()).isEqualTo("true");
        assertThat(progressCondition.matchIfMissing()).isFalse();

        ConditionalOnProperty completionCondition = TrainingCompletionController.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(completionCondition).isNotNull();
        assertThat(completionCondition.havingValue()).isEqualTo("true");
        assertThat(completionCondition.matchIfMissing()).isFalse();

        mvc.perform(get("/api/v1/coaching/training-plans/1/completions?exerciseDate=2026-10-26")
                        .with(authentication(actor("COACH"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/coaching/training-completions/my")
                        .with(authentication(actor("MEMBER"))))
                .andExpect(status().isNotFound());
        verifyNoInteractions(service);
    }
}
