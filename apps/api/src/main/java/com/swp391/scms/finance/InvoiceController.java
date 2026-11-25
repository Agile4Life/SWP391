package com.swp391.scms.finance;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.finance.dto.InvoiceCreateDto;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/** API hóa đơn điện tử cho quầy và quản lý (/api/v1/invoices). */
@Tag(name = "Payments & Invoices", description = "Quản lý giao dịch thu tiền, xuất hóa đơn điện tử và công nợ")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public InvoiceController(InvoiceService invoiceService) {
        this(invoiceService, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public InvoiceController(InvoiceService invoiceService, MessageService messageService) {
        this.invoiceService = invoiceService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST: tạo hóa đơn thủ công cho một khoản thanh toán (HTTP 201). */
    @Operation(summary = "Phát hành hóa đơn điện tử", description = "Tạo hóa đơn điện tử kèm các dòng chi tiết. Tổng tiền do computed column của database tính toán")
    @PostMapping
    public ResponseEntity<ApiResponse<InvoiceDto>> createInvoice(@Valid @RequestBody InvoiceCreateDto dto) {
        InvoiceDto created = invoiceService.createInvoice(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("finance.invoice.created"), created));
    }

    /** POST /auto-issue/{paymentId}: tự xuất hóa đơn cho khoản thanh toán thành công (HTTP 201). */
    @Operation(summary = "Tự động phát hành hóa đơn cho giao dịch thanh toán", description = "Tự động tạo hóa đơn điện tử cho giao dịch đã thanh toán thành công")
    @PostMapping("/auto-issue/{paymentId}")
    public ResponseEntity<ApiResponse<InvoiceDto>> autoIssueInvoice(@PathVariable Long paymentId) {
        InvoiceDto invoice = invoiceService.autoIssueInvoiceForPayment(paymentId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("finance.invoice.auto_issued"), invoice));
    }

    /** GET /{id}: hóa đơn theo id. */
    @Operation(summary = "Xem chi tiết hóa đơn theo ID", description = "Tra cứu hóa đơn điện tử và các dòng sản phẩm/dịch vụ")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InvoiceDto>> getInvoiceById(@PathVariable Long id) {
        InvoiceDto invoice = invoiceService.getInvoiceById(id);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.invoice.detail"), invoice));
    }

    /** GET /by-number/{invoiceNumber}: hóa đơn theo số hóa đơn. */
    @Operation(summary = "Tra cứu hóa đơn theo số hóa đơn", description = "Tra cứu theo mã hóa đơn duy nhất (INV-YYYYMMDD-XXXX)")
    @GetMapping("/by-number/{invoiceNumber}")
    public ResponseEntity<ApiResponse<InvoiceDto>> getInvoiceByNumber(@PathVariable String invoiceNumber) {
        InvoiceDto invoice = invoiceService.getInvoiceByNumber(invoiceNumber);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.invoice.detail"), invoice));
    }

    /** GET /by-payment/{paymentId}: hóa đơn của một khoản thanh toán. */
    @Operation(summary = "Tra cứu hóa đơn theo Payment ID", description = "Xem hóa đơn điện tử gắn liền với một giao dịch thanh toán")
    @GetMapping("/by-payment/{paymentId}")
    public ResponseEntity<ApiResponse<InvoiceDto>> getInvoiceByPaymentId(@PathVariable Long paymentId) {
        InvoiceDto invoice = invoiceService.getInvoiceByPaymentId(paymentId);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.invoice.detail"), invoice));
    }
}

