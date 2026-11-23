package com.swp391.scms.scheduling.service;

import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Settles held class sessions, their per-session bookings and finished course enrollments as {@code completed}.
 *
 * <p>Rows stay open for {@link #GRACE_DAYS} days after the session so the auto-absent sweep (7-day lookback) and late
 * attendance corrections still see them as booked.
 */
@Service
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
public class SessionCompletionScheduler {
    public static final int GRACE_DAYS = 7;
    private static final Logger log = LoggerFactory.getLogger(SessionCompletionScheduler.class);
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ClassSessionRepository sessions;
    private final SessionBookingRepository bookings;
    private final ClassEnrollmentRepository enrollments;
    private final Clock clock;

    public SessionCompletionScheduler(ClassSessionRepository sessions, SessionBookingRepository bookings,
                                      ClassEnrollmentRepository enrollments, Clock clock) {
        this.sessions = sessions;
        this.bookings = bookings;
        this.enrollments = enrollments;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.scheduling.completion.cron:0 30 0 * * ?}")
    public void sweep() {
        try {
            int[] done = completeHeld();
            log.info("[SessionCompletion] completed {} session(s), {} booking(s), {} enrollment(s)", done[0], done[1], done[2]);
        } catch (RuntimeException ex) {
            log.warn("[SessionCompletion] sweep failed", ex);
        }
    }

    /** Returns {sessions, bookings, enrollments} moved to completed. */
    @Transactional
    public int[] completeHeld() {
        LocalDateTime now = clock.instant().atZone(CENTER_ZONE).toLocalDateTime();
        LocalDate cutoff = now.toLocalDate().minusDays(GRACE_DAYS);
        // Bookings and enrollments first: their queries read session dates, not session status.
        int booked = bookings.completeHeldBefore(cutoff);
        int enrolled = enrollments.completeFinishedBefore(cutoff);
        int held = sessions.completeHeldBefore(cutoff, now);
        return new int[]{held, booked, enrolled};
    }
}
