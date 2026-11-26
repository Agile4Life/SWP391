package com.swp391.scms.finance.service;

import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Job đóng các lượt VNPay bị bỏ dở trên trang cổng (không bao giờ có IPN), để đơn có thể thanh toán lại, thu ở
 * quầy hoặc hủy, đồng thời các khung giờ chưa thanh toán sẽ được job hết hạn riêng giải phóng.
 * Mỗi khoản thu được xử lý trong một transaction độc lập để lỗi hoặc xung đột khóa lạc quan trên một khoản không
 * kéo rollback toàn bộ lô.
 */
@Component
public class VnpayExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(VnpayExpiryScheduler.class);
    private final VnpayTransactionRepository transactions;
    private final VnpayPaymentGuard guard;
    private final TransactionTemplate transactionTemplate;

    /** Constructor cho test (không có TransactionManager). */
    public VnpayExpiryScheduler(VnpayTransactionRepository transactions, VnpayPaymentGuard guard) {
        this(transactions, guard, null);
    }

    /** Constructor Spring dùng: tách transaction riêng cho từng khoản thu cần đóng lượt bỏ dở. */
    @Autowired
    public VnpayExpiryScheduler(VnpayTransactionRepository transactions, VnpayPaymentGuard guard,
                                @Autowired(required = false) PlatformTransactionManager transactionManager) {
        this.transactions = transactions;
        this.guard = guard;
        if (transactionManager != null) {
            TransactionTemplate template = new TransactionTemplate(transactionManager);
            template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            this.transactionTemplate = template;
        } else {
            this.transactionTemplate = null;
        }
    }

    /**
     * Chạy mỗi 5 phút: tìm khoản thu có lượt đang chờ đã quá hạn cộng thời gian chờ IPN và đóng từng khoản trong
     * transaction độc lập; trả số khoản đã xử lý thành công.
     */
    @Scheduled(fixedDelayString = "${app.vnpay.expiry-interval-ms:300000}", initialDelayString = "${app.vnpay.expiry-interval-ms:300000}")
    public int closeAbandonedAttempts() {
        var cutoff = guard.now().minus(VnpayPaymentGuard.SETTLEMENT_GRACE);
        var paymentIds = transactions.findPaymentIdsWithPendingExpiredBefore(cutoff);
        int processed = 0;
        for (Long paymentId : paymentIds) {
            try {
                if (transactionTemplate != null) {
                    transactionTemplate.executeWithoutResult(status -> guard.expireStale(paymentId));
                } else {
                    guard.expireStale(paymentId);
                }
                processed++;
            } catch (RuntimeException ex) {
                log.warn("Could not close abandoned VNPay attempts for payment {}: {}", paymentId, ex.getMessage());
            }
        }
        if (processed > 0) log.info("Closed abandoned VNPay attempts for {} payment(s)", processed);
        return processed;
    }
}
