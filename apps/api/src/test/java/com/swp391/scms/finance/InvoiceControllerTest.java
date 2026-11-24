package com.swp391.scms.finance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.finance.dto.InvoiceCreateDto;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.service.InvoiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bộ kiểm thử cho controller InvoiceController (invoice controller). */
@ExtendWith(MockitoExtension.class)
class InvoiceControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private InvoiceService invoiceService;

    @InjectMocks
    private InvoiceController invoiceController;

    /** Chuẩn bị trước mỗi test: dựng MockMvc cho controller hóa đơn. */
    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    /** Kiểm thử: tạo hóa đơn thành công. */
    @Test
    @DisplayName("POST /api/v1/invoices should return 201 Created when request is valid")
    void shouldCreateInvoiceSuccessfully() throws Exception {
        InvoiceCreateDto request = new InvoiceCreateDto();
        request.setPaymentId(10L);
        request.setSubtotalAmount(new BigDecimal("1000000.00"));
        request.setTaxAmount(new BigDecimal("100000.00"));

        InvoiceDto responseDto = new InvoiceDto();
        responseDto.setId(1L);
        responseDto.setInvoiceNumber("INV-20261001-ABCDEF");

        when(invoiceService.createInvoice(any(InvoiceCreateDto.class))).thenReturn(responseDto);

        mockMvc.perform(post("/api/v1/invoices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(201))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.invoiceNumber").value("INV-20261001-ABCDEF"));
    }

    /** Kiểm thử: từ chối request hóa đơn không hợp lệ. */
    @Test
    @DisplayName("POST /api/v1/invoices should return 400 Bad Request when missing paymentId or subtotal")
    void shouldRejectInvalidInvoiceRequest() throws Exception {
        InvoiceCreateDto request = new InvoiceCreateDto();
        request.setSubtotalAmount(new BigDecimal("-100.00")); // số tiền âm, thiếu paymentId

        mockMvc.perform(post("/api/v1/invoices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    /** Kiểm thử: lấy hóa đơn theo id. */
    @Test
    @DisplayName("GET /api/v1/invoices/{id} should return 200 OK")
    void shouldGetInvoiceById() throws Exception {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(1L);

        when(invoiceService.getInvoiceById(1L)).thenReturn(dto);

        mockMvc.perform(get("/api/v1/invoices/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1));
    }

    /** Kiểm thử: lấy hóa đơn theo số hóa đơn. */
    @Test
    @DisplayName("GET /api/v1/invoices/by-number/{invoiceNumber} should return 200 OK")
    void shouldGetInvoiceByNumber() throws Exception {
        InvoiceDto dto = new InvoiceDto();
        dto.setInvoiceNumber("INV-20261001-001");

        when(invoiceService.getInvoiceByNumber("INV-20261001-001")).thenReturn(dto);

        mockMvc.perform(get("/api/v1/invoices/by-number/INV-20261001-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.invoiceNumber").value("INV-20261001-001"));
    }

    /** Kiểm thử: lấy hóa đơn theo mã thanh toán. */
    @Test
    @DisplayName("GET /api/v1/invoices/by-payment/{paymentId} should return 200 OK")
    void shouldGetInvoiceByPaymentId() throws Exception {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(1L);

        when(invoiceService.getInvoiceByPaymentId(10L)).thenReturn(dto);

        mockMvc.perform(get("/api/v1/invoices/by-payment/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1));
    }

    /** Kiểm thử: tự động phát hành hóa đơn thành công. */
    @Test
    @DisplayName("POST /api/v1/invoices/auto-issue/{paymentId} should return 201 Created")
    void shouldAutoIssueInvoiceSuccessfully() throws Exception {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(20L);
        dto.setInvoiceNumber("INV-20261005-A1B2C3");

        when(invoiceService.autoIssueInvoiceForPayment(15L)).thenReturn(dto);

        mockMvc.perform(post("/api/v1/invoices/auto-issue/15"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(20L))
                .andExpect(jsonPath("$.data.invoiceNumber").value("INV-20261005-A1B2C3"));
    }
}
