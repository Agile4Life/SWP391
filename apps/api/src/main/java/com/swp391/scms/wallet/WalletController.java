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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * API Ví SÖL (/api/v1/wallet): hội viên xem ví, nạp qua VNPay, thanh toán bằng ví; quầy xem ví hội viên, nạp
 * tiền tại quầy và xem lịch sử nạp.
 */
@RestController
@RequestMapping("/api/v1/wallet")
public class WalletController {

    /** Body nạp tiền qua VNPay: số tiền từ 10.000đ đến 100.000.000đ. */
    public record TopupRequest(
            @NotNull(message = "{validation.wallet.amount.not_null}")
            @DecimalMin(value = "10000", message = "{validation.wallet.amount.min}")
            @DecimalMax(value = "100000000", message = "{validation.wallet.amount.max}")
            BigDecimal amount
    ) {}

    /**
     * Body nạp tiền tại quầy: số tiền (10.000đ - 100.000.000đ), phương thức, ghi chú và mã request phía client
     * (giống nhau ở mọi lần gửi lại, để mất phản hồi rồi gửi lại cũng chỉ cộng một lần).
     */
    public record StaffTopupRequest(
            @NotNull(message = "{validation.wallet.amount.not_null}")
            @DecimalMin(value = "10000", message = "{validation.wallet.amount.min}")
            @DecimalMax(value = "100000000", message = "{validation.wallet.amount.max}")
            BigDecimal amount,
            @Size(max = 30)
            String paymentMethod,
            @Size(max = 500)
            String note,
            /**
             * Cùng một giá trị ở mọi lần thử lại của một lần nạp, nên gửi lại sau khi mất phản hồi chỉ cộng
             * một lần.
             */
            @Size(min = 8, max = 64)
            @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9-]+")
            String clientRequestId
    ) {
        /** Constructor rút gọn không có mã request phía client. */
        public StaffTopupRequest(BigDecimal amount, String paymentMethod, String note) {
            this(amount, paymentMethod, note, null);
        }
    }

    private final WalletService walletService;
    private final MessageService messageService;
    private final VnpayPaymentService vnpayPaymentService;
    private CounterTopupService counterTopupService;

    /** Gán giá trị mới cho trường counterTopupService. */
    @Autowired(required = false)
    public void setCounterTopupService(CounterTopupService counterTopupService) {
        this.counterTopupService = counterTopupService;
    }

    /** Constructor cho test, chỉ có WalletService. */
    public WalletController(WalletService walletService) {
        this(walletService, null, null);
    }

    /** Constructor cho test, có MessageService. */
    public WalletController(WalletService walletService, MessageService messageService) {
        this(walletService, messageService, null);
    }

    /** Constructor Spring dùng; MessageService và dịch vụ VNPay là tùy chọn. */
    @Autowired
    public WalletController(
            WalletService walletService,
            @Autowired(required = false) MessageService messageService,
            @Autowired(required = false) VnpayPaymentService vnpayPaymentService) {
        this.walletService = walletService;
        this.messageService = messageService;
        this.vnpayPaymentService = vnpayPaymentService;
    }

    /** GET /my: ví của người đang đăng nhập (số dư và 50 giao dịch gần nhất). */
    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<WalletDto> getMyWallet(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        String msg = messageService != null ? messageService.getMessage("wallet.get.success") : "Lấy thông tin Ví thành công";
        return ApiResponse.ok(msg, walletService.getMyWallet(principal.id()));
    }

    /** POST /topup/vnpay: tạo liên kết thanh toán VNPay để nạp tiền vào ví. */
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

    /** POST /pay: thanh toán một khoản (gói, PT...) bằng số dư ví. */
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

    /** GET /members/{memberId}: quầy xem ví của hội viên. */
    @GetMapping("/members/{memberId}")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER','MANAGER')")
    public ApiResponse<WalletDto> getMemberWallet(@PathVariable Long memberId) {
        String msg = messageService != null
                ? messageService.getMessage("wallet.get.success")
                : "Lấy thông tin Ví thành công";
        return ApiResponse.ok(msg, walletService.getMyWallet(memberId));
    }

    /** POST /members/{memberId}/topup: quầy nạp tiền vào ví hội viên. */
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
                staffId,
                body.clientRequestId()
        );
        String msg = messageService != null
                ? messageService.getMessage("wallet.topup.counter.success")
                : "Đã nạp tiền vào Ví hội viên tại quầy thành công";
        return ApiResponse.ok(msg, dto);
    }

    /** GET /counter-topups?days=: lịch sử nạp ví tại quầy. */
    @GetMapping("/counter-topups")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER','MANAGER')")
    public ApiResponse<List<CounterTopupService.TopupHistoryDto>> counterTopupHistory(
            @RequestParam(value = "days", required = false) Integer days) {
        String msg = messageService != null
                ? messageService.getMessage("wallet.topup.counter.history")
                : "Lấy lịch sử nạp Ví tại quầy thành công";
        return ApiResponse.ok(msg, counterTopupService == null ? List.of() : counterTopupService.history(days));
    }
}
