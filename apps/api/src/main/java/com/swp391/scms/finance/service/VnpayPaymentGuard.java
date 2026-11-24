package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Chặn thao tác trên khoản thu khi còn lượt VNPay có thể được cổng xác nhận. Lượt còn pending quá hạn cộng 15
 * phút chờ IPN (khách đã đóng trang cổng) được đóng thành failed; IPN thành công đến muộn vẫn được xử lý khi
 * khoản thu còn chờ.
 *
 * Called under the existing member/booking lock before cashier settlement or cancellation.
 *
 * <p>A VNPay attempt blocks the order only while the gateway may still settle it. VNPay refuses payment after the
 * {@code vnp_ExpireDate} sent at checkout, so an attempt still pending {@link #SETTLEMENT_GRACE} after that moment
 * (the customer closed the gateway page and no IPN will come) is closed as {@code failed}. A late successful IPN for
 * such an attempt is still honoured while its payment is pending, see {@link VnpayPaymentService#ipn}.
 */
@Component
public class VnpayPaymentGuard {
    /** Time allowed after the gateway expiry for a delayed IPN before the attempt is closed locally. */
    public static final Duration SETTLEMENT_GRACE = Duration.ofMinutes(15);
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final VnpayTransactionRepository transactions;
    private final PaymentRepository payments;
    private final Clock clock;

    /** Constructor dùng đồng hồ giờ trung tâm. */
    public VnpayPaymentGuard(VnpayTransactionRepository transactions, PaymentRepository payments) {
        this(transactions, payments, Clock.system(CENTER_ZONE));
    }

    /** Constructor Spring dùng với Clock. */
    @Autowired
    public VnpayPaymentGuard(VnpayTransactionRepository transactions, PaymentRepository payments, Clock clock) {
        this.transactions = transactions;
        this.payments = payments;
        this.clock = clock;
    }

    /** Đóng lượt quá hạn rồi chặn (409) nếu khoản thu vẫn còn lượt đang chờ. */
    public void payment(Long id) {
        expireStale(id);
        if (transactions.existsByPaymentIdAndStatus(id, "pending")) throw blocked();
    }
    /** Kiểm tra mọi khoản thu của một kỳ gói. */
    public void subscription(Long id) { payments.findAllBySubscriptionId(id).forEach(p -> payment(p.getId())); }
    /** Kiểm tra mọi khoản thu của một buổi PT. */
    public void coach(Long id) { payments.findAllByCoachBookingId(id).forEach(p -> payment(p.getId())); }
    /** Kiểm tra mọi khoản thu của một lượt đặt sân. */
    public void court(Long id) { payments.findAllByCourtBookingId(id).forEach(p -> payment(p.getId())); }
    /** Kiểm tra mọi khoản thu của một đơn hàng. */
    public void productOrder(Long id) { payments.findAllByProductOrderId(id).forEach(p -> payment(p.getId())); }
    /** Kiểm tra khoản thu của một đăng ký khóa học. */
    public void enrollment(Long id) { payments.findByClassEnrollmentId(id).ifPresent(p -> payment(p.getId())); }
    /**
     * Trước khi hoàn tiền: chặn nếu còn lượt chờ, và không hỗ trợ hoàn tiền khoản đã trả qua VNPay bằng chức
     * năng này.
     */
    public void refund(Long id) {
        payment(id);
        if (transactions.existsByPaymentIdAndStatus(id, "success")) throw new ConflictException("VNPAY_REFUND_UNSUPPORTED", "finance.vnpay.refund_unsupported", null, null);
    }

    /**
     * Đóng các lượt VNPay của khoản thu đã quá hạn; nếu không còn lượt nào chờ/thành công thì khoản nạp ví đang
     * chờ cũng chuyển failed.
     *
     * Closes this payment's attempts that the gateway can no longer settle.
     */
    public void expireStale(Long paymentId) {
        LocalDateTime now = now();
        var attempts = transactions.findAllByPaymentId(paymentId);
        if (attempts == null) return;
        boolean closedAny = false;
        for (VnpayTransaction attempt : attempts) {
            if (isStale(attempt, now)) {
                attempt.setStatus("failed");
                transactions.save(attempt);
                closedAny = true;
            }
        }
        if (closedAny && payments != null
                && !transactions.existsByPaymentIdAndStatus(paymentId, "pending")
                && !transactions.existsByPaymentIdAndStatus(paymentId, "success")) {
            payments.findById(paymentId).ifPresent(p -> {
                if ("pending".equals(p.getStatus()) && p.getNote() != null && p.getNote().startsWith("WALLET_TOPUP")) {
                    p.setStatus("failed");
                    payments.save(p);
                }
            });
        }
    }

    /**
     * Lượt đang chờ đã quá hạn cổng cộng thời gian chờ IPN chưa.
     *
     * True when an attempt is pending and past the gateway expiry plus the IPN grace period.
     */
    public boolean isStale(VnpayTransaction attempt, LocalDateTime now) {
        return attempt != null && "pending".equals(attempt.getStatus()) && attempt.getExpiresAt() != null
                && attempt.getExpiresAt().plus(SETTLEMENT_GRACE).isBefore(now);
    }

    /** Thời điểm hiện tại theo giờ trung tâm. */
    public LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), CENTER_ZONE); }

    /** Lỗi 409 "đang chờ VNPay xác nhận". */
    private ConflictException blocked() { return new ConflictException("VNPAY_AWAITING_CONFIRMATION", "finance.vnpay.awaiting_confirmation", null, null); }
}
