package com.swp391.scms.scheduling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.WaitlistDto;
import com.swp391.scms.scheduling.service.WaitlistService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SCRUM-74: waitlist endpoint contract tests.
 */
@ExtendWith(MockitoExtension.class)
class WaitlistControllerTest {

    private MockMvc mockMvc;

    @Mock
    private WaitlistService waitlistService;

    private WaitlistController controller;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(12L, "member01", "MEMBER");
        }
    };

    @BeforeEach
    void setUp() {
        new ObjectMapper().registerModule(new JavaTimeModule());
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        controller = new WaitlistController(waitlistService, messageService);
        AcceptHeaderLocaleResolver localeResolver = new AcceptHeaderLocaleResolver();
        localeResolver.setDefaultLocale(new Locale("vi"));

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(principalResolver)
                .setLocaleResolver(localeResolver)
                .build();
    }

    private WaitlistDto sampleDto() {
        return new WaitlistDto(1L, 5L, "Yoga Flow", 12L, "waiting", LocalDateTime.now());
    }

    @Test
    void joinReturnsCreated() throws Exception {
        when(waitlistService.join(any(), anyLong())).thenReturn(sampleDto());

        mockMvc.perform(post("/api/v1/classes/sessions/9/waitlist"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void withdrawReturnsOk() throws Exception {
        when(waitlistService.withdraw(any(), anyLong())).thenReturn(sampleDto());

        mockMvc.perform(delete("/api/v1/classes/waitlists/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void myWaitlistsReturnsList() throws Exception {
        when(waitlistService.myWaitlists(any())).thenReturn(List.of(sampleDto()));

        mockMvc.perform(get("/api/v1/classes/waitlists/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
