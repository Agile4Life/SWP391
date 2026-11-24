package com.swp391.scms.scheduling.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job nền định kỳ nhả chỗ khóa học đang giữ cho các khoản phí chưa thanh toán quá hạn.
 *
 * Định kỳ giải phóng các chỗ khóa học bị giữ bởi khoản phí chưa bao giờ được trả.
 */
@Component
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
public class CourseEnrollmentExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(CourseEnrollmentExpiryScheduler.class);
    private final EnrollmentService service;

    /** Khởi tạo job với EnrollmentService. */
    public CourseEnrollmentExpiryScheduler(EnrollmentService service) {
        this.service = service;
    }

    /**
     * Chạy theo chu kỳ app.courses.expiry-interval-ms (mặc định 60 giây): gọi expireUnpaidCourseEnrollments và
     * ghi log; lỗi chỉ ghi cảnh báo.
     */
    @Scheduled(fixedDelayString = "${app.courses.expiry-interval-ms:60000}", initialDelayString = "${app.courses.expiry-interval-ms:60000}")
    public void releaseUnpaid() {
        try {
            int released = service.expireUnpaidCourseEnrollments();
            if (released > 0) {
                log.info("Released {} unpaid course enrollment(s)", released);
            }
        } catch (RuntimeException e) {
            log.warn("Could not release unpaid course enrollments", e);
        }
    }
}
