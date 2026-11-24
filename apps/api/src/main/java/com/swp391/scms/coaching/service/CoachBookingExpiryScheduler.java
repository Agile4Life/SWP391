package com.swp391.scms.coaching.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job nền chạy định kỳ: giải phóng các khung giờ PT 1:1 đang bị giữ bởi các lịch đặt chưa từng thanh toán quá hạn.
 */
@Component
public class CoachBookingExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(CoachBookingExpiryScheduler.class);
    private final CoachBookingService service;

    /** Khởi tạo job với CoachBookingService (nơi chứa logic hết hạn booking). */
    public CoachBookingExpiryScheduler(CoachBookingService service) {
        this.service = service;
    }

    /**
     * Chạy theo chu kỳ app.coaching.expiry-interval-ms (mặc định 60 giây): gọi expireUnpaidBookings, ghi log số
     * booking được nhả; lỗi chỉ ghi cảnh báo để lần chạy sau thử lại.
     */
    @Scheduled(fixedDelayString = "${app.coaching.expiry-interval-ms:60000}", initialDelayString = "${app.coaching.expiry-interval-ms:60000}")
    public void releaseUnpaid() {
        try {
            int released = service.expireUnpaidBookings();
            if (released > 0) {
                log.info("Released {} unpaid 1:1 PT booking(s)", released);
            }
        } catch (RuntimeException e) {
            log.warn("Could not release unpaid 1:1 PT bookings", e);
        }
    }
}
