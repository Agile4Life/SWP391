package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.scheduling.entity.ClassSession;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

final class SessionEligibility {
    private SessionEligibility() {
    }

    static void ensureBookable(ClassSession session, Clock clock) {
        if ("cancelled".equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException("SCHEDULING_SESSION_CANCELLED", "error.scheduling.session_cancelled",
                    null, "This session has been cancelled");
        }
        if (!"scheduled".equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException("SCHEDULING_SESSION_NOT_BOOKABLE", "error.scheduling.session_not_bookable",
                    null, "This session is not open for booking");
        }
        ensureFuture(session.getSessionDate(), session.getStartTime(), clock);
    }

    static void ensureFuture(LocalDate date, LocalTime start, Clock clock) {
        if (!LocalDateTime.of(date, start).isAfter(LocalDateTime.now(clock))) {
            throw new BadRequestException("SCHEDULING_PAST_SESSION", "error.scheduling.past_session",
                    null, "Session must start in the future");
        }
    }
}
