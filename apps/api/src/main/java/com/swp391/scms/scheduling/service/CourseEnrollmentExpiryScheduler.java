package com.swp391.scms.scheduling.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodically frees course seats held by fees that were never paid. */
@Component
public class CourseEnrollmentExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(CourseEnrollmentExpiryScheduler.class);
    private final EnrollmentService service;

    public CourseEnrollmentExpiryScheduler(EnrollmentService service) {
        this.service = service;
    }

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
