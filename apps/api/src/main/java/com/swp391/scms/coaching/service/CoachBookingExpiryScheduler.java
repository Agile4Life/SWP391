package com.swp391.scms.coaching.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodically releases 1:1 PT slots held by bookings that were never paid. */
@Component
public class CoachBookingExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(CoachBookingExpiryScheduler.class);
    private final CoachBookingService service;

    public CoachBookingExpiryScheduler(CoachBookingService service) {
        this.service = service;
    }

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
