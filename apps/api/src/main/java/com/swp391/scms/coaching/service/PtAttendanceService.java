package com.swp391.scms.coaching.service;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gate check-ins around 1:1 sessions. A gate scan never records attendance: the coach or the desk marks it. The
 * check-in that covered a session is only shown to them as a hint. A session without an arrival after it ended is a
 * no-show: its quota stays used, as the plan has no make-up sessions.
 */
@Service
public class PtAttendanceService {
    /** A visit that began up to this long before a session still covers it (the member came early and stayed). */
    public static final int STAY_BEFORE_HOURS = 3;

    private final CenterCheckinRepository checkins;

    public PtAttendanceService(CenterCheckinRepository checkins) {
        this.checkins = checkins;
    }

    /**
     * Start of a granted gate check-in that was inside the center while the session ran (it began at most
     * {@value #STAY_BEFORE_HOURS} hours before the start), or null. Shown to staff; it never records attendance.
     */
    @Transactional(readOnly = true)
    public LocalDateTime gateCheckinFor(CoachBooking booking) {
        if (booking == null || booking.getMember() == null || booking.getBookingDate() == null
                || booking.getStartTime() == null || booking.getEndTime() == null) return null;
        LocalDateTime start = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        LocalDateTime end = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());
        return checkins.findCoveringVisitStart(booking.getMember().getUserId(), start.minusHours(STAY_BEFORE_HOURS), start, end);
    }
}
