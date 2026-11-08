package com.swp391.scms.wallet;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.VnpayDtos;
import com.swp391.scms.finance.service.VnpayPaymentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/wallet")
public class WalletController {

    public record TopupRequest(
            @NotNull(message = "{validation.wallet.amount.not_null}")
            @DecimalMin(value = "10000", message = "{validation.wallet.amount.min}")
            @DecimalMax(value = "100000000", message = "{validation.wallet.amount.max}")
            BigDecimal amount
    ) {}

    public record StaffTopupRequest(
            @NotNull(message = "{validation.wallet.amount.not_null}")
            @DecimalMin(value = "10000", message = "{validation.wallet.amount.min}")
            @DecimalMax(value = "100000000", message = "{validation.wallet.amount.max}")
            BigDecimal amount,
            @Size(max = 30)
            String paymentMethod,
            @Size(max = 500)
            String note
    ) {}

    private final WalletService walletService;
    private final MessageService messageService;
    private final VnpayPaymentService vnpayPaymentService;

    public WalletController(WalletService walletService) {
        this(walletService, null, null);
    }

    public WalletController(WalletService walletService, MessageService messageService) {
        this(walletService, messageService, null);
    }

    @Autowired
    public WalletController(
            WalletService walletService,
            @Autowired(required = false) MessageService messageService,
            @Autowired(required = false) VnpayPaymentService vnpayPaymentService) {
        this.walletService = walletService;
        this.messageService = messageService;
        this.vnpayPaymentService = vnpayPaymentService;
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<WalletDto> getMyWallet(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        String msg = messageService != null ? messageService.getMessage("wallet.get.success") : "Lấy thông tin Ví thành công";
        return ApiResponse.ok(msg, walletService.getMyWallet(principal.id()));
    }

    @PostMapping("/topup/vnpay")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<VnpayDtos.Checkout> topupWithVnpay(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody TopupRequest body,
            HttpServletRequest request) {
        String ip = request != null && request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
        String origin = request != null
                ? (request.getHeader("Origin") != null ? request.getHeader("Origin") : request.getHeader("Referer"))
                : null;
        String msg = messageService != null
                ? messageService.getMessage("wallet.topup.vnpay.created")
                : "Đã tạo liên kết nạp tiền vào Ví qua VNPay Sandbox";
        return ApiResponse.ok(msg, vnpayPaymentService.topupWallet(principal, body.amount(), ip, origin));
    }

    @PostMapping("/pay")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<WalletDto> payWithWallet(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody VnpayDtos.CheckoutRequest body) {
        String msg = messageService != null
                ? messageService.getMessage("wallet.pay.success")
                : "Thanh toán bằng Ví SÖL thành công";
        return ApiResponse.ok(msg, vnpayPaymentService.payWithWallet(principal, body));
    }

    @GetMapping("/members/{memberId}")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER','MANAGER')")
    public ApiResponse<WalletDto> getMemberWallet(@PathVariable Long memberId) {
        String msg = messageService != null
                ? messageService.getMessage("wallet.get.success")
                : "Lấy thông tin Ví thành công";
        return ApiResponse.ok(msg, walletService.getMyWallet(memberId));
    }

    @PostMapping("/members/{memberId}/topup")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER','MANAGER')")
    public ApiResponse<WalletDto> topupMemberWalletAtCounter(
            @PathVariable Long memberId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody StaffTopupRequest body) {
        Long staffId = principal != null ? principal.id() : null;
        WalletDto dto = walletService.creditByReceptionist(
                memberId,
                body.amount(),
                body.paymentMethod(),
                body.note(),
                staffId
        );
        String msg = messageService != null
                ? messageService.getMessage("wallet.topup.counter.success")
                : "Đã nạp tiền vào Ví hội viên tại quầy thành công";
        return ApiResponse.ok(msg, dto);
    }
}
