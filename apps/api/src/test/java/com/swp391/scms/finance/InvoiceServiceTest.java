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

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneOffset.UTC);
        invoiceService = new InvoiceService(invoiceRepository, paymentRepository, invoiceMapper, clock);
    }

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

    @Test
    void memberInvoiceDoesNotExposeOtherMembersInvoice() {
        when(invoiceRepository.findByPaymentIdAndPaymentMemberUserIdAndPaymentStatus(5L, 8L, "success")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> invoiceService.getMemberInvoiceByPaymentId(5L, 8L));
        verifyNoInteractions(invoiceMapper);
    }

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

    @Test
    @DisplayName("Should throw ResourceNotFoundException when payment ID does not exist")
    void shouldThrowWhenPaymentNotFoundForInvoice() {
        InvoiceCreateDto dto = new InvoiceCreateDto();
        dto.setPaymentId(999L);

        when(paymentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> invoiceService.createInvoice(dto));
        verify(invoiceRepository, never()).save(any());
    }

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

    @Test
    @DisplayName("Should throw BadRequestException when trying to issue invoice for failed or refunded payment")
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
    }

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

    @Test
    @DisplayName("Should throw ResourceNotFoundException when invoice ID not found")
    void shouldThrowWhenInvoiceIdNotFound() {
        when(invoiceRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceById(999L));
    }

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

    @Test
    @DisplayName("Should throw ResourceNotFoundException when invoice number not found")
    void shouldThrowWhenInvoiceNumberNotFound() {
        when(invoiceRepository.findByInvoiceNumber("INV-UNKNOWN")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceByNumber("INV-UNKNOWN"));
    }

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

    @Test
    @DisplayName("Should throw ResourceNotFoundException when payment ID has no invoice")
    void shouldThrowWhenPaymentHasNoInvoice() {
        when(invoiceRepository.findByPaymentId(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> invoiceService.getInvoiceByPaymentId(999L));
    }

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
