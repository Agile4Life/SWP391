package com.swp391.scms.shop.service;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.shop.entity.ProductOrder;
import com.swp391.scms.wallet.WalletService;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Hoàn tiền đơn hàng shop vào ví hội viên. */
@Service
@Transactional
public class ProductOrderRefunds {
    private final PaymentRepository payments;
    private final WalletService walletService;
    private final MessageService messages;

    /** Constructor rút gọn không có MessageService. */
    public ProductOrderRefunds(PaymentRepository payments, WalletService walletService) {
        this(payments, walletService, null);
    }

    /** Constructor chính: nhận repository thanh toán, WalletService và MessageService (tùy chọn). */
    @Autowired
    public ProductOrderRefunds(PaymentRepository payments,
                               @Autowired(required = false) WalletService walletService,
                               @Autowired(required = false) MessageService messages) {
        this.payments = payments;
        this.walletService = walletService;
        this.messages = messages;
    }

    /**
     * Nếu đơn đã thanh toán thành công thì hoàn phần còn lại (trừ phần đã hoàn trước đó) vào ví, đánh dấu
     * payment refunded; trả về số tiền hoàn.
     */
    public BigDecimal refundIfPaid(ProductOrder order, String reason) {
        if (order == null || order.getId() == null) {
            return BigDecimal.ZERO;
        }
        List<Payment> existing = payments.findAllByProductOrderId(order.getId());
        if (existing == null || existing.isEmpty()) {
            return BigDecimal.ZERO;
        }
        Payment paid = existing.stream()
                .filter(p -> "success".equalsIgnoreCase(p.getStatus()))
                .findFirst()
                .orElse(null);
        if (paid == null) {
            return BigDecimal.ZERO;
        }
        // Khoản hoàn một phần làm trước đó ở quầy đã được chi trả rồi.
        BigDecimal amount = paid.netAmount();
        if (amount == null || amount.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        Long memberUserId = order.getMember().getUserId();
        if (walletService != null) {
            walletService.creditOrderRefund(memberUserId, amount, "ORDER_REFUND_" + order.getId(),
                    refundDescription(order, reason), order.getId());
        }
        paid.setStatus("refunded");
        paid.setRefundedAmount(paid.getAmount());
        appendNote(paid, reason);
        payments.save(paid);
        return amount;
    }

    /**
     * VNPay báo thành công sau khi đơn đã hủy: hội viên đã bị trừ tiền nên cộng vào ví và ghi payment là
     * refunded.
     *
     * VNPay báo thành công sau khi đơn đã hủy (thanh toán của nó đã đóng là failed): hội viên đã bị trừ tiền,
     * nên tiền được cộng vào ví và thanh toán được ghi là refunded thay vì bị mất.
     */
    public BigDecimal refundLatePayment(ProductOrder order, Payment payment, BigDecimal amount, String reference) {
        if (order == null || payment == null || amount == null || amount.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        if (walletService != null && order.getMember() != null) {
            String code = orderCode(order);
            walletService.creditOrderRefund(order.getMember().getUserId(), amount, "ORDER_LATE_REFUND_" + reference,
                    msg("wallet.description.product_order_late_payment", "Hoàn tiền thanh toán VNPay đến sau khi đơn " + code + " đã hủy", code),
                    order.getId());
        }
        payment.setStatus("refunded");
        payment.setRefundedAmount(amount);
        appendNote(payment, "VNPay " + reference);
        payments.save(payment);
        return amount;
    }

    /** Mô tả giao dịch hoàn tiền trong ví (kèm lý do nếu có). */
    private String refundDescription(ProductOrder order, String reason) {
        String code = orderCode(order);
        if (reason != null && !reason.isBlank()) {
            return msg("wallet.description.product_order_refund_reason", "Hoàn tiền đơn hàng " + code + ": " + reason, code, reason);
        }
        return msg("wallet.description.product_order_refund", "Hoàn tiền đơn hàng " + code, code);
    }

    /** Mã đơn để hiển thị; thiếu mã thì dùng "#id". */
    private static String orderCode(ProductOrder order) {
        return order.getCode() != null && !order.getCode().isBlank() ? order.getCode() : "#" + order.getId();
    }

    /** Nối thêm ghi chú vào payment, cắt tối đa 255 ký tự. */
    private static void appendNote(Payment payment, String text) {
        if (text == null || text.isBlank()) {
            return;
        }
        String combined = (payment.getNote() != null && !payment.getNote().isBlank())
                ? payment.getNote() + " | " + text
                : text;
        payment.setNote(combined.length() > 255 ? combined.substring(0, 255) : combined);
    }

    /** Dịch message key kèm tham số; không dịch được thì dùng chuỗi dự phòng. */
    private String msg(String key, String fallback, Object... args) {
        if (messages != null) {
            String resolved = messages.getMessage(key, args);
            if (resolved != null && !resolved.isBlank() && !resolved.equals(key)) {
                return resolved;
            }
        }
        return fallback;
    }
}
