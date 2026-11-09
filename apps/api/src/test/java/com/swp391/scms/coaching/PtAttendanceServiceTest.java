package com.swp391.scms.coaching;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.PtAttendanceService;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A gate scan during a 1:1 session marks the arrival; an early visit that stayed is credited by the sweep. */
class PtAttendanceServiceTest {
    private final CoachBookingRepository bookings = mock(CoachBookingRepository.class);
    private final CenterCheckinRepository checkins = mock(CenterCheckinRepository.class);
    // 2026-11-09 20:00 in Ho Chi Minh City
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T13:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final PtAttendanceService service = new PtAttendanceService(bookings, checkins, clock);
    private final LocalDate today = LocalDate.of(2026, 11, 9);
    private Member member;

    @BeforeEach
    void setUp() {
        member = new Member();
        member.setUserId(100L);
    }

    private CoachBooking booking(LocalTime start, LocalTime end) {
        CoachBooking b = new CoachBooking();
        b.setMember(member);
        b.setBookingDate(today);
        b.setStartTime(start);
        b.setEndTime(end);
        return b;
    }

    @Test
    void scanningFromThirtyMinutesBeforeUntilTheEndMarksTheSessionArrived() {
        CoachBooking inWindow = booking(LocalTime.of(17, 0), LocalTime.of(18, 0));
        when(bookings.findOpenForDay(100L, today)).thenReturn(List.of(inWindow));
        LocalDateTime scan = LocalDateTime.of(2026, 11, 9, 16, 35);

        assertEquals(1, service.markArrivedOnEntry(100L, scan));

        assertEquals(scan, inWindow.getAttendedAt());
        verify(bookings).save(inWindow);
    }

    @Test
    void aScanTooEarlyOrAfterTheSessionEndedDoesNotMarkIt() {
        CoachBooking later = booking(LocalTime.of(19, 0), LocalTime.of(20, 0));
        CoachBooking over = booking(LocalTime.of(8, 0), LocalTime.of(9, 0));
        when(bookings.findOpenForDay(100L, today)).thenReturn(List.of(later, over));

        assertEquals(0, service.markArrivedOnEntry(100L, LocalDateTime.of(2026, 11, 9, 17, 0)));

        assertNull(later.getAttendedAt());
        assertNull(over.getAttendedAt());
        verify(bookings, never()).save(any());
    }

    @Test
    void theSweepCreditsAFinishedSessionWhenAVisitCoveredItAndSkipsOthers() {
        CoachBooking covered = booking(LocalTime.of(17, 0), LocalTime.of(18, 0));
        CoachBooking noShow = booking(LocalTime.of(10, 0), LocalTime.of(11, 0));
        CoachBooking notOver = booking(LocalTime.of(21, 0), LocalTime.of(22, 0));
        when(bookings.findOpenBetween(any(), any())).thenReturn(List.of(covered, noShow, notOver));
        LocalDateTime cameIn = LocalDateTime.of(2026, 11, 9, 15, 30);
        when(checkins.findCoveringVisitStart(100L, LocalDateTime.of(2026, 11, 9, 14, 0),
                LocalDateTime.of(2026, 11, 9, 17, 0), LocalDateTime.of(2026, 11, 9, 18, 0))).thenReturn(cameIn);
        when(checkins.findCoveringVisitStart(100L, LocalDateTime.of(2026, 11, 9, 7, 0),
                LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0))).thenReturn(null);

        assertEquals(1, service.creditEarlyVisits());

        assertEquals(cameIn, covered.getAttendedAt());
        assertNull(noShow.getAttendedAt());
        assertNull(notOver.getAttendedAt());
    }
}
