package com.swp391.scms.attendance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CenterCheckinControllerTest {

    private MockMvc mockMvc;

    @Mock
    private CenterCheckinService service;

    private CenterCheckinController controller;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(1L, "receptionist", "RECEPTIONIST");
        }
    };

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @BeforeEach
    void setUp() {
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        controller = new CenterCheckinController(service, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(principalResolver)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
    }

    @Test
    void scan_returnsCreated() throws Exception {
        CheckinRequests.Scan request = new CheckinRequests.Scan("QR-UUID-VALID", "Cổng chính A");
        CheckinDto dto = new CheckinDto(
                1L, 10L, "Nguyễn Văn A", LocalDateTime.now(), null, "qr", "Cổng chính A", "GRANTED"
        );
        when(service.scan(any(), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/check-in/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(1L))
                .andExpect(jsonPath("$.data.status").value("GRANTED"));
    }

    @Test
    void scan_returnsCreatedWhenDenied() throws Exception {
        CheckinRequests.Scan request = new CheckinRequests.Scan("QR-INVALID", "Cổng chính A");
        CheckinDto dto = new CheckinDto(
                2L, null, null, LocalDateTime.now(), null, "qr", "Cổng chính A", "DENIED", "Mã QR không tồn tại"
        );
        when(service.scan(any(), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/check-in/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(2L))
                .andExpect(jsonPath("$.data.status").value("DENIED"))
                .andExpect(jsonPath("$.data.denialReason").value("Mã QR không tồn tại"));
    }

    @Test
    void scan_validationFailsWhenQrBlank() throws Exception {
        CheckinRequests.Scan request = new CheckinRequests.Scan("", "Cổng chính A");

        mockMvc.perform(post("/api/v1/check-in/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void checkout_returnsOk() throws Exception {
        CheckinDto dto = new CheckinDto(
                1L, 10L, "Nguyễn Văn A", LocalDateTime.now().minusHours(1), LocalDateTime.now(), "qr", "Cổng chính A", "GRANTED"
        );
        when(service.checkout(any(), eq(1L))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/check-in/1/checkout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1L))
                .andExpect(jsonPath("$.data.checkOutTime").isNotEmpty());
    }

    @Test
    void history_returnsOk() throws Exception {
        CheckinDto dto = new CheckinDto(
                1L, 10L, "Nguyễn Văn A", LocalDateTime.now(), null, "qr", "Cổng chính A", "GRANTED"
        );
        when(service.history(any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/check-in/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(1L));
    }
}
