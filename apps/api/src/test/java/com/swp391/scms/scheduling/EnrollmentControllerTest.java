package com.swp391.scms.scheduling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.UnpaidCourseEnrollmentDto;
import com.swp391.scms.scheduling.service.EnrollmentService;
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
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bộ kiểm thử hợp đồng endpoint cho EnrollmentController (SCRUM-73).
 */
@ExtendWith(MockitoExtension.class)
class EnrollmentControllerTest {

    private MockMvc mockMvc;

    @Mock
    private EnrollmentService enrollmentService;

    private EnrollmentController controller;

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
            return new AuthenticatedPrincipal(12L, "member01", "MEMBER");
        }
    };

    /** Chuẩn bị trước mỗi test: dựng MockMvc cho controller ghi danh. */
    @BeforeEach
    void setUp() {
        new ObjectMapper().registerModule(new JavaTimeModule());
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);

        controller = new EnrollmentController(enrollmentService, messageService);
        AcceptHeaderLocaleResolver localeResolver = new AcceptHeaderLocaleResolver();
        localeResolver.setDefaultLocale(new Locale("vi"));

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(principalResolver)
                .setLocaleResolver(localeResolver)
                .build();
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (sample dto). */
    private EnrollmentDto sampleDto() {
        return new EnrollmentDto(1L, 5L, "Yoga Flow", 12L, 9L,
                LocalDate.of(2026, 11, 27), LocalTime.of(18, 0), LocalTime.of(19, 0),
                "booked", LocalDateTime.of(2026, 11, 26, 10, 0), null, null);
    }

    /** Kiểm thử: ghi danh theo từng buổi đã ngừng hoạt động. */
    @Test
    void perSessionEnrollIsRetired() throws Exception {
        mockMvc.perform(post("/api/v1/classes/sessions/9/enroll"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(enrollmentService, org.mockito.Mockito.never()).enroll(any(), anyLong());
    }

    /** Kiểm thử: hủy ghi danh trả 200 OK. */
    @Test
    void cancelReturnsOk() throws Exception {
        when(enrollmentService.cancel(any(), anyLong())).thenReturn(sampleDto());

        mockMvc.perform(delete("/api/v1/classes/enrollments/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /** Kiểm thử: endpoint danh sách ghi danh của tôi tồn tại. */
    @Test
    void myEnrollmentsEndpointExists() throws Exception {
        mockMvc.perform(get("/api/v1/classes/enrollments/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /** Kiểm thử P0-03: GET /enrollments/unpaid trả danh sách học phí khóa học chờ thanh toán tại quầy. */
    @Test
    void unpaidCourseEnrollmentsReturnsPendingList() throws Exception {
        UnpaidCourseEnrollmentDto item = new UnpaidCourseEnrollmentDto(
                77L, 88L, 5L, "Yoga Flow", "Yoga",
                LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20),
                12L, "Nguyễn Văn A", "0901234567", "SOL-00012",
                new BigDecimal("500000.00"), "cash", LocalDateTime.of(2026, 11, 10, 9, 0));
        when(enrollmentService.listUnpaidCourseEnrollments()).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/classes/enrollments/unpaid").header("Accept-Language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Pending course tuition enrollments retrieved successfully"))
                .andExpect(jsonPath("$.data[0].enrollmentId").value(77))
                .andExpect(jsonPath("$.data[0].paymentId").value(88))
                .andExpect(jsonPath("$.data[0].className").value("Yoga Flow"))
                .andExpect(jsonPath("$.data[0].method").value("cash"));
    }

    /** Kiểm thử P0-03: POST /enrollments/{id}/confirm-payment chấp nhận cả JSON body lẫn query param method. */
    @Test
    void confirmCoursePaymentAcceptsBodyAndQueryParam() throws Exception {
        PaymentDto dto = new PaymentDto();
        dto.setId(88L);
        dto.setClassEnrollmentId(77L);
        dto.setStatus("success");
        dto.setMethod("bank_transfer");
        when(enrollmentService.confirmCourseEnrollmentPayment(any(), eq(77L), eq("bank_transfer"))).thenReturn(dto);

        mockMvc.perform(post("/api/v1/classes/enrollments/77/confirm-payment")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"method\":\"bank_transfer\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Course tuition payment confirmed successfully"))
                .andExpect(jsonPath("$.data.id").value(88))
                .andExpect(jsonPath("$.data.status").value("success"));

        verify(enrollmentService).confirmCourseEnrollmentPayment(any(), eq(77L), eq("bank_transfer"));

        PaymentDto cashDto = new PaymentDto();
        cashDto.setId(89L);
        cashDto.setStatus("success");
        cashDto.setMethod("cash");
        when(enrollmentService.confirmCourseEnrollmentPayment(any(), eq(78L), eq("cash"))).thenReturn(cashDto);

        mockMvc.perform(post("/api/v1/classes/enrollments/78/confirm-payment").param("method", "cash"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.method").value("cash"));
        verify(enrollmentService).confirmCourseEnrollmentPayment(any(), eq(78L), eq("cash"));
    }
}
