package com.swp391.scms.coaching.service;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.CenterTime;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Arrival at 1:1 sessions. A gate scan from 30 minutes before a session until its end marks the member as arrived;
 * a sweep also credits members who came in earlier and stayed. A session without an arrival after it ended is a
 * no-show: its quota stays used, as the plan has no make-up sessions.
 */
@Service
public class PtAttendanceService {
    private static final Logger log = LoggerFactory.getLogger(PtAttendanceService.class);
    /** How early before a session a gate scan already counts as arriving for it. */
    public static final int EARLY_MINUTES = 30;
    /** A visit that began up to this long before a session still covers it (the member came early and stayed). */
    public static final int STAY_BEFORE_HOURS = 3;
    private static final int LOOKBACK_DAYS = 3;

    private final CoachBookingRepository bookings;
    private final CenterCheckinRepository checkins;
    private final Clock clock;

    public PtAttendanceService(CoachBookingRepository bookings, CenterCheckinRepository checkins, Clock clock) {
        this.bookings = bookings;
        this.checkins = checkins;
        this.clock = clock;
    }

    /** Called when a member enters: marks today's sessions they have just arrived for. Returns how many. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public int markArrivedOnEntry(Long memberId, LocalDateTime now) {
        if (memberId == null || now == null) return 0;
        int marked = 0;
        for (CoachBooking booking : bookings.findOpenForDay(memberId, now.toLocalDate())) {
            LocalDateTime start = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
            LocalDateTime end = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());
            if (now.isBefore(start.minusMinutes(EARLY_MINUTES)) || now.isAfter(end)) continue;
            booking.setAttendedAt(now);
            bookings.save(booking);
            marked++;
        }
        return marked;
    }

    @Scheduled(cron = "${app.attendance.pt-arrival.cron:0 5/30 * * * ?}")
    public void sweep() {
        try {
            int credited = creditEarlyVisits();
            if (credited > 0) log.info("[PtAttendance] credited {} session(s) to members who arrived early", credited);
        } catch (RuntimeException ex) {
            log.warn("[PtAttendance] sweep failed", ex);
        }
    }

    /** Finished sessions with no arrival get one when a visit covered them. Returns how many were credited. */
    @Transactional
    public int creditEarlyVisits() {
        LocalDateTime now = LocalDateTime.now(clock.withZone(CenterTime.ZONE));
        LocalDate today = now.toLocalDate();
        int credited = 0;
        for (CoachBooking booking : bookings.findOpenBetween(today.minusDays(LOOKBACK_DAYS), today)) {
            LocalDateTime start = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
            LocalDateTime end = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());
            if (end.isAfter(now) || booking.getMember() == null) continue;
            LocalDateTime visit = checkins.findCoveringVisitStart(booking.getMember().getUserId(),
                    start.minusHours(STAY_BEFORE_HOURS), start, end);
            if (visit != null) {
                booking.setAttendedAt(visit);
                bookings.save(booking);
                credited++;
            }
        }
        return credited;
    }
}
