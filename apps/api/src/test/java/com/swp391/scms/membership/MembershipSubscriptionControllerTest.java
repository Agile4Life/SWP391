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

/** Bộ kiểm thử cho controller MembershipSubscriptionController (membership subscription controller). */
@ExtendWith(MockitoExtension.class)
class MembershipSubscriptionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private MembershipSubscriptionService service;

    private MembershipSubscriptionController controller;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        /** Bộ phân giải tham số giả của test: cho biết có hỗ trợ tham số này không. */
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        /** Bộ phân giải tham số giả của test: cấp principal đã đăng nhập cho tham số controller. */
        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return new AuthenticatedPrincipal(10L, "member01", "MEMBER");
        }
    };

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    /** Chuẩn bị trước mỗi test: dựng MockMvc cho controller subscription. */
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

    /** Kiểm thử: tiếp tục trả subscription hoạt động và thông báo đã bản địa hóa. */
    @Test
    void resume_returnsActiveSubscriptionAndLocalizedMessage() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(100L, 10L, 1L, "Essential", null,
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 20), "active", "paid-qr", LocalDateTime.now());
        when(service.resume(any(), eq(100L))).thenReturn(dto);
        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/resume").header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.status").value("active"))
                .andExpect(jsonPath("$.message").value("Subscription resumed successfully at no additional charge."));
    }

    /** Kiểm thử: tạo subscription trả 201. */
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

    /** Kiểm thử: thiếu packageId thì validation báo lỗi. */
    @Test
    void create_validationFailsWhenPackageIdNull() throws Exception {
        mockMvc.perform(post("/api/v1/memberships/subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    /** Kiểm thử: gia hạn trả 201. */
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

    /** Kiểm thử: nâng cấp trả 201. */
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

    /** Kiểm thử: yêu cầu tạm hoãn nhận multipart gồm ngày và giấy tờ. */
    @Test
    void requestHold_acceptsMultipartWithDatesAndDocuments() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "active", "QR-SUB-100", LocalDateTime.now(),
                "PENDING", "Đi công tác", LocalDateTime.now(), null
        );
        when(service.requestHold(any(), eq(100L), any(), any())).thenReturn(dto);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/v1/memberships/subscriptions/100/hold")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "documents", "giay-ra-vien.pdf", "application/pdf", new byte[]{1, 2, 3}))
                        .param("reason", "Đi công tác")
                        .param("startDate", "2026-10-14")
                        .param("endDate", "2026-10-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.holdStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.holdReason").value("Đi công tác"));
        org.mockito.ArgumentCaptor<SubscriptionRequests.HoldRequest> captured =
                org.mockito.ArgumentCaptor.forClass(SubscriptionRequests.HoldRequest.class);
        org.mockito.ArgumentCaptor<java.util.List<MembershipSubscriptionService.HoldDocumentUpload>> docs =
                org.mockito.ArgumentCaptor.forClass(java.util.List.class);
        org.mockito.Mockito.verify(service).requestHold(any(), eq(100L), captured.capture(), docs.capture());
        org.assertj.core.api.Assertions.assertThat(captured.getValue().startDate()).isEqualTo(LocalDate.of(2026, 10, 14));
        org.assertj.core.api.Assertions.assertThat(captured.getValue().endDate()).isEqualTo(LocalDate.of(2026, 10, 20));
        org.assertj.core.api.Assertions.assertThat(docs.getValue()).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(docs.getValue().get(0).fileName()).isEqualTo("giay-ra-vien.pdf");
    }

    /** Kiểm thử: liệt kê tạm hoãn chuyển bộ lọc trạng thái cho service. */
    @Test
    void listHolds_passesTheStatusFilterToTheService() throws Exception {
        when(service.listHolds("PENDING")).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/memberships/subscriptions/holds").param("status", "PENDING"))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(service).listHolds("PENDING");
    }

    /** Kiểm thử: duyệt tạm hoãn trả 200 kèm số mục đã hủy. */
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

    /** Kiểm thử: hủy yêu cầu đang chờ trả 200. */
    @Test
    void cancelPending_returnsOk() throws Exception {
        SubscriptionDto dto = new SubscriptionDto(
                100L, 10L, 1L, "Gói 1 tháng", null,
                LocalDate.now(), LocalDate.now().plusDays(30), "cancelled", null, LocalDateTime.now()
        );
        when(service.cancelPending(any(), eq(100L), org.mockito.ArgumentMatchers.isNull())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/memberships/subscriptions/100/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(100L))
                .andExpect(jsonPath("$.data.status").value("cancelled"));
    }

    @Test
    void cancelPending_passesReasonToService() throws Exception {
        mockMvc.perform(post("/api/v1/memberships/subscriptions/50/cancel")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Wrong package\"}"))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(service).cancelPending(any(), eq(50L), eq("Wrong package"));
    }

    @Test
    void cancelPending_rejectsTooLongBody() throws Exception {
        mockMvc.perform(post("/api/v1/memberships/subscriptions/50/cancel")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verifyNoInteractions(service);
    }

    /** Kiểm thử: lấy subscription của tôi trả 200 kèm đối tượng. */
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

    /** Kiểm thử: lấy subscription của tôi trả 200 với null khi không có gói hoạt động. */
    @Test
    void getMy_returnsOk_withNullWhenNoActiveSubscription() throws Exception {
        when(service.current(any())).thenReturn(null);

        mockMvc.perform(get("/api/v1/memberships/subscriptions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    /** Kiểm thử: lấy lịch sử trả danh sách. */
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
