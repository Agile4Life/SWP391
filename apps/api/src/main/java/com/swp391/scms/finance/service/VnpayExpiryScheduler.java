package com.swp391.scms.finance.service;

import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Job đóng các lượt VNPay bị bỏ dở trên trang cổng (không bao giờ có IPN), để đơn có thể thanh toán lại, thu ở
 * quầy hoặc hủy.
 *
 * Closes VNPay attempts abandoned on the gateway page (no IPN ever arrives), so the order can be paid again,
 * settled at the counter or cancelled, and unpaid court slots are released by their own expiry job.
 */
@Component
public class VnpayExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(VnpayExpiryScheduler.class);
    private final VnpayTransactionRepository transactions;
    private final VnpayPaymentGuard guard;

    /** Nhận repository lượt VNPay và bộ chặn VNPay. */
    public VnpayExpiryScheduler(VnpayTransactionRepository transactions, VnpayPaymentGuard guard) {
        this.transactions = transactions;
        this.guard = guard;
    }

    /**
     * Chạy mỗi 5 phút: tìm khoản thu có lượt đang chờ đã quá hạn cộng thời gian chờ IPN và đóng chúng; trả số
     * khoản đã xử lý.
     */
    @Scheduled(fixedDelayString = "${app.vnpay.expiry-interval-ms:300000}", initialDelayString = "${app.vnpay.expiry-interval-ms:300000}")
    @Transactional
    public int closeAbandonedAttempts() {
        var cutoff = guard.now().minus(VnpayPaymentGuard.SETTLEMENT_GRACE);
        var paymentIds = transactions.findPaymentIdsWithPendingExpiredBefore(cutoff);
        paymentIds.forEach(guard::expireStale);
        if (!paymentIds.isEmpty()) log.info("Closed abandoned VNPay attempts for {} payment(s)", paymentIds.size());
        return paymentIds.size();
    }
}
