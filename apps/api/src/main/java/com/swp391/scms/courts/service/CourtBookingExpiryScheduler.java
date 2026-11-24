package com.swp391.scms.courts.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job nền định kỳ nhả các khung sân đang giữ bởi lượt đặt chưa thanh toán quá hạn.
 *
 * Định kỳ giải phóng các khung sân bị giữ bởi lượt đặt chưa bao giờ được trả.
 */
@Component
@ConditionalOnProperty(name = "app.legacy.courts-enabled", havingValue = "true")
public class CourtBookingExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(CourtBookingExpiryScheduler.class);
    private final CourtBookingService service;

    /** Khởi tạo job với CourtBookingService. */
    public CourtBookingExpiryScheduler(CourtBookingService service) { this.service = service; }

    /**
     * Chạy theo chu kỳ app.courts.expiry-interval-ms (mặc định 60 giây): gọi expireUnpaid và ghi log; lỗi chỉ
     * ghi cảnh báo.
     */
    @Scheduled(fixedDelayString = "${app.courts.expiry-interval-ms:60000}", initialDelayString = "${app.courts.expiry-interval-ms:60000}")
    public void releaseUnpaid() {
        try {
            int released = service.expireUnpaid();
            if (released > 0) log.info("Released {} unpaid court booking(s)", released);
        } catch (RuntimeException e) {
            log.warn("Could not release unpaid court bookings", e);
        }
    }
}
