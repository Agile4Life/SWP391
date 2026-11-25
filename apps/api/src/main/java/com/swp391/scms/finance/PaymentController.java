package com.swp391.scms.finance;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.finance.dto.PaymentCreateDto;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.dto.PaymentProcessDto;
import com.swp391.scms.finance.dto.PaymentStatusUpdateRequest;
import com.swp391.scms.finance.service.PaymentService;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

/**
 * API thanh toán (/api/v1/payments): quầy thu tiền và cập nhật trạng thái, hội viên xem khoản của mình, quản lý
 * hoàn tiền.
 */
@Tag(name = "Payments & Invoices", description = "Quản lý giao dịch thu tiền, xuất hóa đơn điện tử và công nợ")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public PaymentController(PaymentService paymentService) {
        this(paymentService, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public PaymentController(PaymentService paymentService, MessageService messageService) {
        this.paymentService = paymentService;
        this.messageService = messageService;
    }
    //key
    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST /process: quầy thu tiền một bước cho gói tập/khóa học (tạo khoản thu, kích hoạt gói, xuất hóa đơn). */
    @Operation(summary = "Xử lý thanh toán mua gói hoặc ghi danh", description = "Tiếp nhận thanh toán và tự động kích hoạt gói tập / ghi danh lớp học kèm sinh mã QR")
    @PostMapping("/process")
    public ResponseEntity<ApiResponse<PaymentDto>> processPayment(@Valid @RequestBody PaymentProcessDto dto) {
        PaymentDto processed = paymentService.processPayment(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("finance.payment.processed"), processed));
    }

    /** POST: tạo khoản thanh toán; hội viên chỉ được tạo khoản đang chờ cho chính mình. */
    @Operation(summary = "Tạo mới giao dịch thanh toán", description = "Tạo phiếu thu tiền học phí, gói tập qua POS, Tiền mặt, Chuyển khoản")
    @PostMapping
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<PaymentDto>> createPayment(@Valid @RequestBody PaymentCreateDto dto,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        PaymentDto created = paymentService.createPayment(principal, dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("finance.payment.created"), created));
    }

    /** GET /my: các khoản thanh toán của hội viên đang đăng nhập. */
    @Operation(summary = "Lịch sử thanh toán của hội viên đang đăng nhập")
    @GetMapping("/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<List<PaymentDto>>> getMyPayments(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.payment.list"),
                paymentService.getPaymentsByMemberId(principal.id())));
    }

    /** GET /{id}: chi tiết một khoản thanh toán. */
    @Operation(summary = "Xem chi tiết giao dịch thanh toán", description = "Tra cứu giao dịch theo Payment ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PaymentDto>> getPaymentById(@PathVariable Long id) {
        PaymentDto payment = paymentService.getPaymentById(id);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.payment.detail"), payment));
    }

    /** GET /member/{memberId}: các khoản thanh toán của một hội viên. */
    @Operation(summary = "Lịch sử thanh toán của hội viên", description = "Lấy tất cả giao dịch thanh toán của một hội viên")
    @GetMapping("/member/{memberId}")
    public ResponseEntity<ApiResponse<List<PaymentDto>>> getPaymentsByMemberId(@PathVariable Long memberId) {
        List<PaymentDto> payments = paymentService.getPaymentsByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.payment.list"), payments));
    }

    /** PATCH /{id}/status: quầy đổi trạng thái khoản thu (pending ↔ success/failed). */
    @Operation(summary = "Cập nhật trạng thái thanh toán", description = "Chuyển trạng thái giao dịch sang success, pending, failed, refunded")
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<PaymentDto>> updatePaymentStatus(
            @PathVariable Long id,
            @Valid @RequestBody PaymentStatusUpdateRequest request) {
        PaymentDto updated = paymentService.updatePaymentStatusByStaff(id, request.status());
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.payment.status_updated"), updated));
    }

    /** POST /{id}/refund: quản lý hoàn tiền một phần hoặc toàn bộ kèm lý do. */
    @Operation(summary = "Hoàn tiền và hủy giao dịch", description = "Ghi nhận hoàn tiền, chuyển trạng thái payment sang refunded, hủy gói tập/ghi danh liên quan và ghi audit log")
    @PostMapping("/{id}/refund")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ResponseEntity<ApiResponse<PaymentDto>> refundPayment(
            @PathVariable Long id,
            @Valid @RequestBody com.swp391.scms.finance.dto.PaymentRefundRequest request) {
        PaymentDto refunded = paymentService.refundPayment(id, request);
        return ResponseEntity.ok(ApiResponse.ok(msg("finance.payment.refunded"), refunded));
    }
}

