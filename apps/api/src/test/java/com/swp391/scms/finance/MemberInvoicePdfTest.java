package com.swp391.scms.finance;

import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.finance.service.MemberInvoicePdfService;
import com.swp391.scms.common.exception.ServiceUnavailableException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberInvoicePdfTest {
    @Test
    void generatesDownloadFromOwnedPersistedInvoice() throws Exception {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceDto invoice = new InvoiceDto();
        invoice.setInvoiceNumber("INV-20261025-ABCDEF");
        invoice.setPaymentId(12L);
        invoice.setIssuedAt(LocalDateTime.of(2026, 10, 25, 10, 0));
        invoice.setSubtotalAmount(new BigDecimal("200000.00"));
        invoice.setTaxAmount(new BigDecimal("20000.00"));
        invoice.setTotalAmount(new BigDecimal("219000.00"));
        when(invoiceService.getMemberInvoiceByPaymentId(12L, 7L)).thenReturn(invoice);

        byte[] pdf = new MemberInvoicePdfService(invoiceService).download(12L, 7L);

        assertTrue(pdf.length > 100);
        assertEquals("%PDF", new String(pdf, 0, 4, java.nio.charset.StandardCharsets.US_ASCII));
        try (var document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains("INV-20261025-ABCDEF"));
            assertTrue(text.contains("VAT: 20000.00 VND"));
            assertTrue(text.contains("219000.00 VND"));
            assertFalse(text.contains("220000.00 VND"));
            assertTrue(text.contains("không thay thế hóa đơn thuế ký số"));
        }
        verify(invoiceService).getMemberInvoiceByPaymentId(12L, 7L);
    }

    @Test
    void refusesMissingPersistedTotal() {
        InvoiceService invoiceService = mock(InvoiceService.class);
        InvoiceDto invoice = new InvoiceDto();
        invoice.setInvoiceNumber("INV-12");
        invoice.setIssuedAt(LocalDateTime.now());
        when(invoiceService.getMemberInvoiceByPaymentId(12L, 7L)).thenReturn(invoice);
        assertThrows(ServiceUnavailableException.class, () -> new MemberInvoicePdfService(invoiceService).download(12L, 7L));
    }
}
