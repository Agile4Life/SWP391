package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.dto.InvoiceItemDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/** Tạo file PDF hóa đơn cho hội viên tải về (dùng thư viện PDFBox với font hỗ trợ tiếng Việt). */
@Service
public class MemberInvoicePdfService {
    private final InvoiceService invoiceService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public MemberInvoicePdfService(InvoiceService invoiceService) {
        this(invoiceService, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public MemberInvoicePdfService(InvoiceService invoiceService,
                                   @Autowired(required = false) MessageService messageService) {
        this.invoiceService = invoiceService;
        this.messageService = messageService;
    }

    /** Tải PDF hóa đơn: kiểm tra quyền sở hữu trước khi đọc nội dung, thiếu số tiền thì báo lỗi, rồi dựng PDF. */
    public byte[] download(Long paymentId, Long userId) {
        // Quyền sở hữu được xác minh trước khi đọc bất kỳ nội dung hóa đơn nào để kết xuất.
        InvoiceDto invoice = invoiceService.getMemberInvoiceByPaymentId(paymentId, userId);
        if (invoice.getTotalAmount() == null || invoice.getSubtotalAmount() == null || invoice.getTaxAmount() == null
                || invoice.getInvoiceNumber() == null || invoice.getIssuedAt() == null || invoice.getPaymentId() == null) {
            throw unavailable();
        }
        return render(invoice);
    }

    private static final float MARGIN_X = 52f;
    private static final float PAGE_WIDTH = 595f;
    private static final float CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
    private static final float RIGHT_X = PAGE_WIDTH - MARGIN_X;
    private static final Color INK_DARK = new Color(32, 32, 32);
    private static final Color INK_MUTED = new Color(108, 106, 102);
    private static final Color LINE_BORDER = new Color(220, 218, 212);
    private static final Color SURFACE_SHADE = new Color(245, 244, 240);
    private static final Color ACCENT_SHADE = new Color(249, 242, 239);

    /** Dựng trang PDF: hóa đơn điện tử trình bày dạng biên lai chuẩn, cột canh phải rõ ràng; thiếu font thì báo 503. */
    private byte[] render(InvoiceDto invoice) {
        try (PDDocument document = new PDDocument();
             InputStream regularStream = PDDocument.class.getResourceAsStream(
                     "/org/apache/pdfbox/resources/ttf/LiberationSans-Regular.ttf");
             InputStream boldStream = PDDocument.class.getResourceAsStream(
                     "/org/apache/pdfbox/resources/ttf/LiberationSans-Bold.ttf")) {
            if (regularStream == null) throw unavailable();
            PDType0Font regular = PDType0Font.load(document, regularStream);
            PDType0Font bold = boldStream != null ? PDType0Font.load(document, boldStream) : regular;
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                String issuedAtFormatted = invoice.getIssuedAt()
                        .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
                String issuedLabel = msg("finance.invoice.pdf.issued_at",
                        "Ngày phát hành: " + issuedAtFormatted, issuedAtFormatted);
                String paymentLabel = msg("finance.invoice.pdf.payment_id",
                        "Giao dịch: #" + invoice.getPaymentId(), invoice.getPaymentId());
                String disclaimer = msg("finance.invoice.pdf.disclaimer",
                        "Tài liệu xuất từ dữ liệu hệ thống; không thay thế hóa đơn thuế ký số.");

                float topY = 785f;
                float padX = MARGIN_X + 20f;
                float innerRightX = RIGHT_X - 20f;
                float innerWidth = innerRightX - padX;

                // Đầu trang hóa đơn: thương hiệu bên trái, số hóa đơn & ngày phát hành bên phải
                float y = topY - 28f;
                drawText(content, bold, 18, INK_DARK, padX, y, "SÖL FITNESS");
                drawRightText(content, bold, 13, INK_DARK, innerRightX, y + 2f, invoice.getInvoiceNumber());
                y -= 16f;
                drawText(content, bold, 9, INK_MUTED, padX, y, "HÓA ĐƠN ĐIỆN TỬ");
                drawRightText(content, regular, 9, INK_MUTED, innerRightX, y, issuedLabel);

                y -= 16f;
                drawHorizontalLine(content, padX, innerRightX, y, LINE_BORDER);

                // Thông tin giao dịch
                y -= 20f;
                drawText(content, regular, 10, INK_MUTED, padX, y, "Mã giao dịch");
                drawRightText(content, bold, 10, INK_DARK, innerRightX, y, "#" + invoice.getPaymentId());

                y -= 18f;
                drawText(content, regular, 10, INK_MUTED, padX, y, "Trạng thái");
                drawRightText(content, bold, 10, INK_DARK, innerRightX, y, "Đã thanh toán");

                y -= 18f;
                drawText(content, regular, 10, INK_MUTED, padX, y, "Tham chiếu");
                drawRightText(content, regular, 10, INK_DARK, innerRightX, y, paymentLabel);

                // Bảng chi tiết dịch vụ
                y -= 20f;
                drawFilledRect(content, padX, y - 6f, innerWidth, 24f, SURFACE_SHADE);
                drawText(content, bold, 9, INK_MUTED, padX + 8f, y + 2f, "DỊCH VỤ");
                drawRightText(content, bold, 9, INK_MUTED, innerRightX - 150f, y + 2f, "SL");
                drawRightText(content, bold, 9, INK_MUTED, innerRightX - 8f, y + 2f, "THÀNH TIỀN");
                y -= 26f;

                List<InvoiceItemDto> items = invoice.getItems();
                if (items != null && !items.isEmpty()) {
                    for (InvoiceItemDto item : items) {
                        String desc = item.getDescription() != null && !item.getDescription().isBlank()
                                ? item.getDescription() : "Dịch vụ tại SÖL Fitness";
                        int qty = item.getQuantity() != null ? item.getQuantity() : 1;
                        BigDecimal lineTotal = item.getAmount() != null ? item.getAmount() : invoice.getSubtotalAmount();
                        drawText(content, bold, 10, INK_DARK, padX + 8f, y, truncate(desc, 42));
                        drawRightText(content, regular, 10, INK_DARK, innerRightX - 150f, y, String.valueOf(qty));
                        drawRightText(content, bold, 10, INK_DARK, innerRightX - 8f, y, formatVnd(lineTotal));
                        y -= 22f;
                    }
                } else {
                    drawText(content, bold, 10, INK_DARK, padX + 8f, y, "Dịch vụ tại SÖL Fitness");
                    drawRightText(content, regular, 10, INK_DARK, innerRightX - 150f, y, "1");
                    drawRightText(content, bold, 10, INK_DARK, innerRightX - 8f, y, formatVnd(invoice.getSubtotalAmount()));
                    y -= 22f;
                }

                drawHorizontalLine(content, padX, innerRightX, y + 4f, LINE_BORDER);

                // Tổng hợp tiền
                y -= 18f;
                drawText(content, regular, 10, INK_MUTED, padX, y, "Trước thuế");
                drawRightText(content, regular, 10, INK_DARK, innerRightX, y, formatVnd(invoice.getSubtotalAmount()));

                y -= 18f;
                drawText(content, regular, 10, INK_MUTED, padX, y, "VAT");
                drawRightText(content, regular, 10, INK_DARK, innerRightX, y, formatVnd(invoice.getTaxAmount()));

                y -= 14f;
                drawFilledRect(content, padX, y - 16f, innerWidth, 30f, ACCENT_SHADE);
                drawText(content, bold, 12, INK_DARK, padX + 8f, y - 6f, "Tổng tiền");
                drawRightText(content, bold, 12, INK_DARK, innerRightX - 8f, y - 6f, formatVnd(invoice.getTotalAmount()));

                // Ghi chú chân trang
                y -= 36f;
                drawHorizontalLine(content, padX, innerRightX, y + 10f, LINE_BORDER);
                drawText(content, regular, 8.5f, INK_MUTED, padX, y - 6f, disclaimer);

                // Khung viền ngoài toàn bộ hóa đơn
                float bottomY = y - 24f;
                content.setStrokingColor(LINE_BORDER);
                content.setLineWidth(1f);
                content.addRect(MARGIN_X, bottomY, CONTENT_WIDTH, topY - bottomY);
                content.stroke();
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        } catch (IOException | IllegalArgumentException e) {
            throw unavailable();
        }
    }

    /** Định dạng tiền VND có dấu phân cách hàng nghìn (ví dụ: 549.000 VND). */
    private String formatVnd(BigDecimal amount) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.GERMANY);
        symbols.setGroupingSeparator('.');
        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        return format.format(amount) + " VND";
    }

    private String truncate(String text, int maxLen) {
        return text.length() <= maxLen ? text : text.substring(0, maxLen - 1) + "…";
    }

    private void drawText(PDPageContentStream content, PDType0Font font, float size, Color color,
                          float x, float y, String value) throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.setNonStrokingColor(color);
        content.newLineAtOffset(x, y);
        content.showText(value);
        content.endText();
    }

    private void drawRightText(PDPageContentStream content, PDType0Font font, float size, Color color,
                               float rightX, float y, String value) throws IOException {
        float textWidth = (font.getStringWidth(value) / 1000f) * size;
        drawText(content, font, size, color, rightX - textWidth, y, value);
    }

    private void drawHorizontalLine(PDPageContentStream content, float x1, float x2, float y, Color color)
            throws IOException {
        content.setStrokingColor(color);
        content.setLineWidth(0.8f);
        content.moveTo(x1, y);
        content.lineTo(x2, y);
        content.stroke();
    }

    private void drawFilledRect(PDPageContentStream content, float x, float y, float width, float height, Color color)
            throws IOException {
        content.setNonStrokingColor(color);
        content.addRect(x, y, width, height);
        content.fill();
    }

    /** Dịch mã thông báo kèm tham số; không dịch được thì dùng câu dự phòng. */
    private String msg(String key, String fallback, Object... args) {
        if (messageService == null) {
            return fallback;
        }
        try {
            String resolved = messageService.getMessage(key, args);
            return (resolved == null || resolved.isBlank() || key.equals(resolved)) ? fallback : resolved;
        } catch (Exception e) {
            return fallback;
        }
    }

    /** Lỗi 503 "không tạo được PDF hóa đơn". */
    private ServiceUnavailableException unavailable() {
        return new ServiceUnavailableException("INVOICE_PDF_UNAVAILABLE", "finance.invoice.pdf_unavailable", null,
                "This invoice PDF is not available yet");
    }
}
