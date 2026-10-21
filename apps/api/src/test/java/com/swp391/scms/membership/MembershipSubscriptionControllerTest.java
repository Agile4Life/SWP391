package com.swp391.scms.membership;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.HoldRequestDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
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

import java.time.LocalDate;
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
class MembershipSubscriptionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private MembershipSubscriptionService service;

    private MembershipSubscriptionController controller;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(10L, "member01", "MEMBER");
        }
    };

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @BeforeEach
    void setUp() {
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        controller = new MembershipSubscriptionController(service, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(principalResolver)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
    }

    @Test
    void create_returnsCreated() throws Exception {
        SubscriptionRequests.Create request = new SubscriptionRequests.Create(1L);
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "pending_payment", null, LocalDateTime.now()
        );
        when(service.create(any(), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.status").value("pending_payment"));
    }

    @Test
    void create_validationFailsWhenPackageIdNull() throws Exception {
        mockMvc.perform(post("/api/v1/memberships/subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void renew_returnsCreated() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                101L, 10L, 1L, "Gói 1 tháng", 100L,
                LocalDate.now().plusDays(31), LocalDate.now().plusDays(61), "pending_payment", null, LocalDateTime.now()
        );
        when(service.renew(any(), eq(100L))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/renew"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(101L))
                .andExpect(jsonPath("$.data.previousSubscriptionId").value(100L));
    }

    @Test
    void upgrade_returnsCreated() throws Exception {
        SubscriptionRequests.Upgrade request = new SubscriptionRequests.Upgrade(2L);
        SubscriptionDto dto = new SubscriptionDto(
                102L, 10L, 2L, "Gói VIP 3 tháng", 100L,
                LocalDate.now(), LocalDate.now().plusDays(89), "pending_payment", null, LocalDateTime.now()
        );
        when(service.upgrade(any(), eq(100L), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/upgrade")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(102L))
                .andExpect(jsonPath("$.data.packageId").value(2L))
                .andExpect(jsonPath("$.data.previousSubscriptionId").value(100L));
    }

    @Test
    void requestHold_returnsOk() throws Exception {
        SubscriptionRequests.HoldRequest request = new SubscriptionRequests.HoldRequest("Đi công tác");
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "active", "QR-SUB-100", LocalDateTime.now(),
                "PENDING", "Đi công tác", LocalDateTime.now(), null
        );
        when(service.requestHold(any(), eq(100L), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/hold")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.holdStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.holdReason").value("Đi công tác"));
    }

    @Test
    void approveHold_returnsOkWithCancelledCount() throws Exception {
        HoldRequestDto dto = new HoldRequestDto(
                100L, 10L, "MB-010", "Nguyen Van A", "a@example.com", "0900000001",
                1L, "Gói 1 tháng", LocalDate.now(), LocalDate.now().plusDays(30),
                "frozen", "APPROVED", "Đi công tác", LocalDateTime.now(), LocalDateTime.now(), 2
        );
        when(service.approveHold(any(), eq(100L))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/hold/approve"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("frozen"))
                .andExpect(jsonPath("$.data.holdStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.cancelledEnrollmentsCount").value(2));
    }

    @Test
    void cancelPending_returnsOk() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "cancelled", null, LocalDateTime.now()
        );
        when(service.cancelPending(any(), eq(100L))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.status").value("cancelled"));
    }

    @Test
    void getMy_returnsOk_withSubscriptionObject() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "active", "QR-SUB-100", LocalDateTime.now()
        );
        when(service.current(any())).thenReturn(dto);

        mockMvc.perform(get("/api/v1/memberships/subscriptions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.qrCode").value("QR-SUB-100"));

        mockMvc.perform(get("/api/v1/subscriptions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L));
    }

    @Test
    void getMy_returnsOk_withNullWhenNoActiveSubscription() throws Exception {
        when(service.current(any())).thenReturn(null);

        mockMvc.perform(get("/api/v1/memberships/subscriptions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void getHistory_returnsList() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "active", "QR-SUB-100", LocalDateTime.now()
        );
        when(service.mine(any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/memberships/subscriptions/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(100L));
    }
}
