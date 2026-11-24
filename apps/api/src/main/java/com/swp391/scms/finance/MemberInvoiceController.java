package com.swp391.scms.finance;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.finance.service.MemberInvoicePdfService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/** API hóa đơn của chính hội viên (/api/v1/invoices/my): xem và tải PDF. */
@RestController
@RequestMapping("/api/v1/invoices/my")
@PreAuthorize("hasRole('MEMBER')")
@Tag(name = "Payments & Invoices")
public class MemberInvoiceController {
    private final InvoiceService invoiceService;
    private final MessageService messageService;
    private final MemberInvoicePdfService pdfService;

    /** Constructor cho test, không có MessageService. */
    public MemberInvoiceController(InvoiceService invoiceService, MemberInvoicePdfService pdfService) {
        this(invoiceService, null, pdfService);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public MemberInvoiceController(InvoiceService invoiceService, MessageService messageService,
            MemberInvoicePdfService pdfService) {
        this.invoiceService = invoiceService;
        this.messageService = messageService;
        this.pdfService = pdfService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /by-payment/{paymentId}: hóa đơn của khoản thanh toán thành công thuộc chính hội viên. */
    @GetMapping("/by-payment/{paymentId}")
    @Operation(summary = "Xem hóa đơn của giao dịch thuộc hội viên đang đăng nhập")
    public ApiResponse<InvoiceDto> getMine(@PathVariable Long paymentId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("finance.invoice.detail"),
                invoiceService.getMemberInvoiceByPaymentId(paymentId, principal.id()));
    }

    /** GET /by-payment/{paymentId}/download: tải hóa đơn dạng PDF (không cho cache). */
    @GetMapping(value = "/by-payment/{paymentId}/download", produces = "application/pdf")
    @Operation(summary = "Tải bản PDF thông tin hóa đơn của hội viên")
    public ResponseEntity<byte[]> download(@PathVariable Long paymentId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        byte[] pdf = pdfService.download(paymentId, principal.id());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("invoice-" + paymentId + ".pdf").build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(pdf);
    }
}
