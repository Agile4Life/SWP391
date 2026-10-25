package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.finance.dto.InvoiceDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.format.DateTimeFormatter;

@Service
public class MemberInvoicePdfService {
    private final InvoiceService invoiceService;

    public MemberInvoicePdfService(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    public byte[] download(Long paymentId, Long userId) {
        // Ownership is resolved before any invoice content is read for rendering.
        InvoiceDto invoice = invoiceService.getMemberInvoiceByPaymentId(paymentId, userId);
        if (invoice.getTotalAmount() == null || invoice.getSubtotalAmount() == null || invoice.getTaxAmount() == null
                || invoice.getInvoiceNumber() == null || invoice.getIssuedAt() == null || invoice.getPaymentId() == null) {
            throw unavailable();
        }
        return render(invoice);
    }

    private byte[] render(InvoiceDto invoice) {
        try (PDDocument document = new PDDocument();
             InputStream fontStream = PDDocument.class.getResourceAsStream(
                     "/org/apache/pdfbox/resources/ttf/LiberationSans-Regular.ttf")) {
            if (fontStream == null) throw unavailable();
            PDType0Font font = PDType0Font.load(document, fontStream);
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float y = 760;
                y = line(content, font, 16, y, "SÖL — BẢN SAO THÔNG TIN HÓA ĐƠN");
                y = line(content, font, 10, y - 8, "Tài liệu xuất từ dữ liệu hệ thống; không thay thế hóa đơn thuế ký số.");
                y = line(content, font, 12, y - 24, "Mã hóa đơn: " + invoice.getInvoiceNumber());
                y = line(content, font, 12, y, "Giao dịch: #" + invoice.getPaymentId());
                y = line(content, font, 12, y, "Ngày phát hành: " + invoice.getIssuedAt()
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
                y = line(content, font, 12, y - 20, "Trước thuế: " + invoice.getSubtotalAmount().toPlainString() + " VND");
                y = line(content, font, 12, y, "VAT: " + invoice.getTaxAmount().toPlainString() + " VND");
                line(content, font, 14, y, "Tổng tiền (đã lưu): " + invoice.getTotalAmount().toPlainString() + " VND");
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        } catch (IOException | IllegalArgumentException e) {
            throw unavailable();
        }
    }

    private float line(PDPageContentStream content, PDType0Font font, int size, float y, String value)
            throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(50, y);
        content.showText(value);
        content.endText();
        return y - 28;
    }

    private ServiceUnavailableException unavailable() {
        return new ServiceUnavailableException("INVOICE_PDF_UNAVAILABLE", "finance.invoice.pdf_unavailable", null,
                "This invoice PDF is not available yet");
    }
}
