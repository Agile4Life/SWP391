package com.swp391.scms.common;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.swp391.scms.config.WebConfig;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** Bộ kiểm thử cho CenterTime (center time). */
class CenterTimeTest {
    /** Kiểm thử: đồng hồ ứng dụng chạy theo múi giờ của trung tâm. */
    @Test
    void applicationClockRunsInTheCenterTimezone() {
        var clock = new WebConfig("http://localhost:5173").clock();

        assertEquals(CenterTime.ZONE, clock.getZone());
        var sample = clock.instant();
        var utcHour = sample.atOffset(java.time.ZoneOffset.UTC).getHour();
        var centerHour = LocalDateTime.ofInstant(sample, clock.getZone()).getHour();
        assertEquals((utcHour + 7) % 24, centerHour);
        assertEquals(java.time.ZoneOffset.ofHours(7), clock.getZone().getRules().getOffset(sample));
    }

    /** Kiểm thử: múi giờ mặc định theo trung tâm. */
    @Test
    void defaultTimezoneFollowsTheCenter() {
        var previous = java.util.TimeZone.getDefault();
        try {
            CenterTime.useAsDefault();
            assertEquals(CenterTime.ZONE.getId(), java.util.TimeZone.getDefault().getID());
        } finally {
            java.util.TimeZone.setDefault(previous);
        }
    }
}
