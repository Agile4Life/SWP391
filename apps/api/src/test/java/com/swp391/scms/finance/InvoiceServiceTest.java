package com.swp391.scms.finance;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.finance.dto.InvoiceCreateDto;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.dto.InvoiceItemCreateDto;
import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.InvoiceItem;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.mapper.InvoiceMapper;
import com.swp391.scms.finance.repository.InvoiceRepository;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.InvoiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service InvoiceService (invoice service). */
@ExtendWith(MockitoExtension.class)
class InvoiceServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private InvoiceMapper invoiceMapper;

    private Clock clock;
    private InvoiceService invoiceService;

    /** Chuẩn bị trước mỗi test: tạo InvoiceService với repository giả lập. */
    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneOffset.UTC);
        invoiceService = new InvoiceService(invoiceRepository, paymentRepository, invoiceMapper, clock);
    }

    /** Kiểm thử: hóa đơn của hội viên dùng truy vấn theo chủ sở hữu và chỉ tổng tiền đã lưu. */
    @Test
    void memberInvoiceUsesOwnedQueryAndPersistedTotalOnly() {
        Invoice invoice = new Invoice();
        invoice.setSubtotalAmount(new BigDecimal("100.00"));
        invoice.setTaxAmount(new BigDecimal("10.00"));
        invoice.setTotalAmount(new BigDecimal("109.00"));
        InvoiceDto mapped = new InvoiceDto();
        mapped.setTotalAmount(new BigDecimal("110.00"));
        mapped.setPdfUrl("private/invoice.pdf");
        when(invoiceRepository.findByPaymentIdAndPaymentMemberUserIdAndPaymentStatus(5L, 7L, "success")).thenReturn(Optional.of(invoice));
        when(invoiceMapper.toDto(invoice)).thenReturn(mapped);

        InvoiceDto result = invoiceService.getMemberInvoiceByPaymentId(5L, 7L);

        assertEquals(new BigDecimal("109.00"), result.getTotalAmount());
        assertNull(result.getPdfUrl());
        verify(invoiceRepository, never()).findByPaymentId(5L);
    }

    /** Kiểm thử: hóa đơn của hội viên không lộ hóa đơn của người khác. */
    @Test
    void memberInvoiceDoesNotExposeOtherMembersInvoice() {
        when(invoiceRepository.findByPaymentIdAndPaymentMemberUserIdAndPaymentStatus(5L, 8L, "success")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> invoiceService.getMemberInvoiceByPaymentId(5L, 8L));
        verifyNoInteractions(invoiceMapper);
    }

    /** Kiểm thử: tạo hóa đơn với số hóa đơn tự sinh. */
    @Test
    @DisplayName("Should create invoice with auto-generated invoice number when blank")
    void shouldCreateInvoiceWithGeneratedNumber() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);
        dto.setSubtotalAmount(new BigDecimal("1000000.00"));
        dto.setTaxAmount(new BigDecimal("100000.00"));

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");

        Invoice invoice = new Invoice();
        InvoiceDto expectedDto = new InvoiceDto();
        expectedDto.setId(1L);

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.empty());
        when(invoiceMapper.toEntity(dto)).thenReturn(invoice);
        when(invoiceRepository.save(invoice)).thenReturn(invoice);
        when(invoiceMapper.toDto(invoice)).thenReturn(expectedDto);

        InvoiceDto result = invoiceService.createInvoice(dto);

        assertNotNull(result);
        assertEquals(1L, result.getId());
        assertNotNull(invoice.getInvoiceNumber());
        assertTrue(invoice.getInvoiceNumber().startsWith("INV-20261001-"));
        assertEquals(payment, invoice.getPayment());
        assertEquals(LocalDateTime.now(clock), invoice.getIssuedAt());
        verify(invoiceRepository).save(invoice);
    }

    /** Kiểm thử: tạo hóa đơn với số hóa đơn cho trước. */
    @Test
    @DisplayName("Should create invoice with provided custom invoice number")
    void shouldCreateInvoiceWithProvidedNumber() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);
        dto.setInvoiceNumber("INV-CUSTOM-001");
        dto.setSubtotalAmount(new BigDecimal("1000000.00"));

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");

        Invoice invoice = new Invoice();
        InvoiceDto expectedDto = new InvoiceDto();

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.empty());
        when(invoiceRepository.existsByInvoiceNumber("INV-CUSTOM-001")).thenReturn(false);
        when(invoiceMapper.toEntity(dto)).thenReturn(invoice);
        when(invoiceRepository.save(invoice)).thenReturn(invoice);
        when(invoiceMapper.toDto(invoice)).thenReturn(expectedDto);

        InvoiceDto result = invoiceService.createInvoice(dto);

        assertNotNull(result);
        assertEquals("INV-CUSTOM-001", invoice.getInvoiceNumber());
    }

    /** Kiểm thử: gắn các dòng vào hóa đơn đã tạo. */
    @Test
    @DisplayName("Should add invoice items when present in DTO")
    void shouldAttachItemsToCreatedInvoice() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);
        dto.setSubtotalAmount(new BigDecimal("2000000.00"));

        InvoiceItemCreateDto itemDto = new InvoiceItemCreateDto();
        itemDto.setDescription("PT Session");
        itemDto.setQuantity(2);
        itemDto.setUnitPrice(new BigDecimal("1000000.00"));
        dto.setItems(List.of(itemDto));

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");

        Invoice invoice = new Invoice();
        InvoiceItem item = new InvoiceItem("PT Session", 2, new BigDecimal("1000000.00"));

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.empty());
        when(invoiceMapper.toEntity(dto)).thenReturn(invoice);
        when(invoiceMapper.toItemEntity(itemDto)).thenReturn(item);
        when(invoiceRepository.save(invoice)).thenReturn(invoice);
        when(invoiceMapper.toDto(invoice)).thenReturn(new InvoiceDto());

        invoiceService.createInvoice(dto);

        assertEquals(1, invoice.getItems().size());
        assertEquals(invoice, item.getInvoice());
    }

    /** Kiểm thử: ném lỗi khi không tìm thấy thanh toán của hóa đơn. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when payment ID does not exist")
    void shouldThrowWhenPaymentNotFoundForInvoice() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(999L);

        when(paymentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> invoiceService.createInvoice(dto));
        verify(invoiceRepository, never()).save(any());
    }

    /** Kiểm thử: ném lỗi khi thanh toán đã có hóa đơn. */
    @Test
    @DisplayName("Should throw ConflictException when payment already has an invoice")
    void shouldThrowWhenPaymentAlreadyHasInvoice() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.of(new Invoice()));

        assertThrows(ConflictException.class, () -> invoiceService.createInvoice(dto));
        verify(invoiceRepository, never()).save(any());
    }

    /** Kiểm thử: ném lỗi khi số hóa đơn đã tồn tại. */
    @Test
    @DisplayName("Should throw ConflictException when provided invoice number already exists")
    void shouldThrowWhenInvoiceNumberAlreadyExists() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);
        dto.setInvoiceNumber("INV-EXISTS");

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.empty());
        when(invoiceRepository.existsByInvoiceNumber("INV-EXISTS")).thenReturn(true);

        assertThrows(ConflictException.class, () -> invoiceService.createInvoice(dto));
        verify(invoiceRepository, never()).save(any());
    }

    /** Kiểm thử: ném lỗi khi tạo hóa đơn cho thanh toán thất bại, đã hoàn hoặc đang chờ xử lý. */
    @Test
    @DisplayName("Should throw BadRequestException when trying to issue invoice for non-success payment")
    void shouldThrowWhenCreatingInvoiceForFailedOrRefundedPayment() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("failed");

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> invoiceService.createInvoice(dto));

        payment.setStatus("refunded");
        assertThrows(BadRequestException.class, () -> invoiceService.createInvoice(dto));

        payment.setStatus("pending");
        BadRequestException pendingEx = assertThrows(BadRequestException.class, () -> invoiceService.createInvoice(dto));
        assertEquals("INVALID_PAYMENT_STATE", pendingEx.getErrorCode());
    }

    /** Kiểm thử P3-BE-12: từ chối xuất hóa đơn thủ công khi subtotal + tax không khớp số tiền thanh toán. */
    @Test
    @DisplayName("Should reject manual invoice when subtotal plus tax does not match payment amount")
    void shouldRejectManualInvoiceWhenSubtotalPlusTaxMismatchesPaymentAmount() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(10L);
        dto.setSubtotalAmount(new BigDecimal("1000000.00"));
        dto.setTaxAmount(new BigDecimal("100000.00"));

        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("1000000.00"));

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(10L)).thenReturn(Optional.empty());

        BadRequestException ex = assertThrows(BadRequestException.class, () -> invoiceService.createInvoice(dto));
        assertEquals("INVOICE_AMOUNT_MISMATCH", ex.getErrorCode());
        verify(invoiceRepository, never()).save(any());

        // Khớp đúng tổng payment.amount -> cho phép lưu
        payment.setAmount(new BigDecimal("1100000"));
        Invoice invoice = new Invoice();
        when(invoiceMapper.toEntity(dto)).thenReturn(invoice);
        when(invoiceRepository.save(invoice)).thenReturn(invoice);
        when(invoiceMapper.toDto(invoice)).thenReturn(new InvoiceDto());
        assertNotNull(invoiceService.createInvoice(dto));
    }

    /** Kiểm thử: lấy hóa đơn theo id. */
    @Test
    @DisplayName("Should return InvoiceDto when queried by ID")
    void shouldGetInvoiceById() {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        InvoiceDto expectedDto = new InvoiceDto();
        expectedDto.setId(1L);

        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
        when(invoiceMapper.toDto(invoice)).thenReturn(expectedDto);

        InvoiceDto result = invoiceService.getInvoiceById(1L);
        assertEquals(1L, result.getId());
    }

    /** Kiểm thử: ném lỗi khi không tìm thấy id hóa đơn. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when invoice ID not found")
    void shouldThrowWhenInvoiceIdNotFound() {
        when(invoiceRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceById(999L));
    }

    /** Kiểm thử: lấy hóa đơn theo số hóa đơn. */
    @Test
    @DisplayName("Should return InvoiceDto when queried by invoice number")
    void shouldGetInvoiceByNumber() {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber("INV-001");
        InvoiceDto expectedDto = new InvoiceDto();
        expectedDto.setInvoiceNumber("INV-001");

        when(invoiceRepository.findByInvoiceNumber("INV-001")).thenReturn(Optional.of(invoice));
        when(invoiceMapper.toDto(invoice)).thenReturn(expectedDto);

        InvoiceDto result = invoiceService.getInvoiceByNumber("INV-001");
        assertEquals("INV-001", result.getInvoiceNumber());
    }

    /** Kiểm thử: ném lỗi khi không tìm thấy số hóa đơn. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when invoice number not found")
    void shouldThrowWhenInvoiceNumberNotFound() {
        when(invoiceRepository.findByInvoiceNumber("INV-UNKNOWN")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceByNumber("INV-UNKNOWN"));
    }

    /** Kiểm thử: lấy hóa đơn theo mã thanh toán. */
    @Test
    @DisplayName("Should return InvoiceDto when queried by payment ID")
    void shouldGetInvoiceByPaymentId() {
        Invoice invoice = new Invoice();
        InvoiceDto expectedDto = new InvoiceDto();

        when(invoiceRepository.findByPaymentId(5L)).thenReturn(Optional.of(invoice));
        when(invoiceMapper.toDto(invoice)).thenReturn(expectedDto);

        InvoiceDto result = invoiceService.getInvoiceByPaymentId(5L);
        assertNotNull(result);
    }

    /** Kiểm thử: ném lỗi khi thanh toán chưa có hóa đơn. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when payment ID has no invoice")
    void shouldThrowWhenPaymentHasNoInvoice() {
        when(invoiceRepository.findByPaymentId(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceByPaymentId(999L));
    }

    /** Kiểm thử: tự động phát hành hóa đơn cho thanh toán thành công. */
    @Test
    @DisplayName("Should automatically issue invoice for successful payment")
    void shouldAutoIssueInvoiceForSuccessfulPayment() {
        Payment payment = new Payment();
        payment.setId(50L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("2000000.00"));

        when(paymentRepository.findById(50L)).thenReturn(Optional.of(payment));
        when(invoiceRepository.findByPaymentId(50L)).thenReturn(Optional.empty());
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invoiceMapper.toDto(any(Invoice.class))).thenReturn(new InvoiceDto());

        InvoiceDto result = invoiceService.autoIssueInvoiceForPayment(50L);
        assertNotNull(result);
        verify(invoiceRepository).save(any(Invoice.class));
    }

    /** Kiểm thử: từ chối tự phát hành cho thanh toán đang chờ. */
    @Test
    @DisplayName("Should throw BadRequestException when auto-issuing invoice for non-success payment")
    void shouldRejectAutoIssueForPendingPayment() {
        Payment payment = new Payment();
        payment.setId(50L);
        payment.setStatus("pending");

        when(paymentRepository.findById(50L)).thenReturn(Optional.of(payment));
        assertThrows(BadRequestException.class, () -> invoiceService.autoIssueInvoiceForPayment(50L));
    }
}
