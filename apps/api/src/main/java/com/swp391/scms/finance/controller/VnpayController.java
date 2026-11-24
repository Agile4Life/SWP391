package com.swp391.scms.finance.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.VnpayDtos.*;
import com.swp391.scms.finance.service.VnpayPaymentService;
import com.swp391.scms.finance.service.VnpayIpnHandler;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** API thanh toán VNPay (/api/v1/payments/vnpay) cho hội viên, và endpoint IPN công khai cho VNPay gọi. */
@RestController
@RequestMapping("/api/v1/payments/vnpay")
public class VnpayController {
    private final VnpayPaymentService payments;
    private final VnpayIpnHandler ipn;
    private final MessageService messages;
    /** Nhận dịch vụ VNPay, bộ xử lý IPN và MessageService. */
    public VnpayController(VnpayPaymentService payments,VnpayIpnHandler ipn,MessageService messages) {
        this.payments=payments;this.ipn=ipn;this.messages=messages;
    }
    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {return messages!=null?messages.getMessage(key):key;}
    /** GET /config: VNPay có đang bật không. */
    @GetMapping("/config") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Configuration> config() {return ApiResponse.ok(msg("finance.vnpay.config"),new Configuration(payments.enabled()));}
    /** POST /checkout: tạo lượt thanh toán và trả link sang cổng VNPay. */
    @PostMapping("/checkout") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Checkout> checkout(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckoutRequest body,HttpServletRequest request) {
        String ip = request != null && request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
        String origin = request != null
                ? (request.getHeader("Origin") != null ? request.getHeader("Origin") : request.getHeader("Referer"))
                : null;
        return ApiResponse.ok(msg("finance.vnpay.checkout_created"),payments.checkout(principal,body,ip,origin));
    }
    /** GET /transactions/{reference}: trạng thái một lượt thanh toán. */
    @GetMapping("/transactions/{reference}") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Status> status(@AuthenticationPrincipal AuthenticatedPrincipal principal,@PathVariable String reference) {
        return ApiResponse.ok(msg("finance.vnpay.status"),payments.status(principal,reference));
    }
    /** POST /transactions/{reference}/cancel: hội viên hủy lượt chưa thanh toán khi thoát cổng. */
    @PostMapping("/transactions/{reference}/cancel") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Status> cancel(@AuthenticationPrincipal AuthenticatedPrincipal principal,@PathVariable String reference) {
        return ApiResponse.ok(msg("finance.vnpay.cancelled"),payments.cancel(principal,reference));
    }
    /** POST /cancel: hủy mọi lượt đang chờ của một đối tượng thanh toán. */
    @PostMapping("/cancel") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Void> cancelTarget(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckoutRequest body) {
        payments.cancelTarget(principal, body);
        return ApiResponse.ok(msg("finance.vnpay.cancelled"), null);
    }
    /** POST /verify-return: kiểm tra tham số trang quay về từ VNPay (như IPN) để cập nhật ngay. */
    @PostMapping("/verify-return") @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Status> verifyReturn(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestBody(required = false) Map<String,String> params) {
        String reference = params != null ? params.get("vnp_TxnRef") : null;
        if (params != null && params.containsKey("vnp_SecureHash")) {
            ipn.process(params, com.swp391.scms.finance.entity.VnpayIpnEvent.SOURCE_RETURN);
        }
        return ApiResponse.ok(msg("finance.vnpay.status"),payments.status(principal,reference));
    }
    /** GET /ipn: VNPay gọi báo kết quả thanh toán (không cần đăng nhập, xác thực bằng chữ ký). */
    @GetMapping("/ipn") @PreAuthorize("permitAll()")
    public Map<String,String> ipn(@RequestParam MultiValueMap<String,String> params) {return ipn.handle(params);}
}
