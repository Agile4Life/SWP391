package com.swp391.scms.scheduling;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.service.MemberScheduleGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho MemberScheduleGuard (P2-BE-21: bỏ buổi quá khứ/không scheduled và gộp 2 truy vấn khoảng ngày). */
@ExtendWith(MockitoExtension.class)
class MemberScheduleGuardTest {

    @Mock private ClassSessionRepository sessions;
    @Mock private CoachBookingRepository coachBookings;

    // 2026-11-10 10:00 giờ Việt Nam (03:00 UTC)
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-10T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final LocalDate today = LocalDate.of(2026, 11, 10);
    private MemberScheduleGuard guard;

    @BeforeEach
    void setUp() {
        guard = new MemberScheduleGuard(sessions, coachBookings, clock);
    }

    private static ClassSession session(GymClass owner, LocalDate date, ScheduleSlot slot, String status) {
        ClassSession s = new ClassSession();
        s.setGymClass(owner);
        s.setSessionDate(date);
        s.setStartTime(slot.startTime());
        s.setEndTime(slot.endTime());
        s.setStatus(status);
        return s;
    }

    @Test
    void ensureCourseFreeSkipsPastCancelledAndCompletedSessionsWithoutRangeQueries() {
        GymClass course = new GymClass();
        course.setId(10L);
        course.setName("Yoga");

        ClassSession pastScheduled = session(course, today.minusDays(2), ScheduleSlot.SLOT_1, "scheduled");
        ClassSession endedToday = session(course, today, ScheduleSlot.SLOT_1, "scheduled"); // kết thúc 09:30 < 10:00
        ClassSession completed = session(course, today.plusDays(1), ScheduleSlot.SLOT_2, "completed");
        ClassSession cancelled = session(course, today.plusDays(2), ScheduleSlot.SLOT_2, "cancelled");

        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(10L))
                .thenReturn(List.of(pastScheduled, endedToday, completed, cancelled));

        assertDoesNotThrow(() -> guard.ensureCourseFree(100L, course));

        verify(sessions, never()).findActiveByMemberBetween(any(), any(), any());
        verify(sessions, never()).findActiveByMemberAndDate(any(), any());
        verifyNoInteractions(coachBookings);
    }

    @Test
    void ensureCourseFreeUsesTwoRangeQueriesAcrossMultipleUpcomingSessionsAndDetectsPtConflict() {
        GymClass course = new GymClass();
        course.setId(10L);
        course.setName("Boxing");

        LocalDate d1 = today.plusDays(1);
        LocalDate d2 = today.plusDays(3);
        LocalDate d3 = today.plusDays(8);
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(10L)).thenReturn(List.of(
                session(course, today.minusDays(3), ScheduleSlot.SLOT_5, "completed"),
                session(course, d1, ScheduleSlot.SLOT_5, "scheduled"),
                session(course, d2, ScheduleSlot.SLOT_5, "scheduled"),
                session(course, d3, ScheduleSlot.SLOT_5, "scheduled")));

        when(sessions.findActiveByMemberBetween(100L, d1, d3)).thenReturn(List.of());
        CoachBooking conflictPt = new CoachBooking();
        conflictPt.setBookingDate(d3);
        conflictPt.setStartTime(ScheduleSlot.SLOT_5.startTime());
        conflictPt.setEndTime(ScheduleSlot.SLOT_5.endTime());
        conflictPt.setStatus("confirmed");
        when(coachBookings.findFutureConfirmedByMember(100L, d1)).thenReturn(List.of(conflictPt));

        ConflictException ex = assertThrows(ConflictException.class, () -> guard.ensureCourseFree(100L, course));
        assertEquals("MEMBER_SCHEDULE_CONFLICT", ex.getErrorCode());

        verify(sessions, times(1)).findActiveByMemberBetween(100L, d1, d3);
        verify(coachBookings, times(1)).findFutureConfirmedByMember(100L, d1);
        verify(sessions, never()).findActiveByMemberAndDate(any(), any());
        verify(coachBookings, never()).findActiveByMemberAndDate(any(), any());
    }

    @Test
    void ensureCourseFreeDetectsClassOverlapAndIgnoresSameCourse() {
        GymClass course = new GymClass();
        course.setId(10L);
        course.setName("Boxing");
        GymClass otherClass = new GymClass();
        otherClass.setId(20L);
        otherClass.setName("Yoga");

        LocalDate d1 = today.plusDays(2);
        LocalDate d2 = today.plusDays(5);
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(10L)).thenReturn(List.of(
                session(course, d1, ScheduleSlot.SLOT_2, "scheduled"),
                session(course, d2, ScheduleSlot.SLOT_2, "scheduled")));

        // Cùng lớp (id=10) phải được bỏ qua; lớp khác (id=20) vào d2 cùng slot -> xung đột
        when(sessions.findActiveByMemberBetween(100L, d1, d2)).thenReturn(List.of(
                session(course, d1, ScheduleSlot.SLOT_2, "scheduled"),
                session(otherClass, d2, ScheduleSlot.SLOT_2, "scheduled")));
        when(coachBookings.findFutureConfirmedByMember(100L, d1)).thenReturn(List.of());

        ConflictException ex = assertThrows(ConflictException.class, () -> guard.ensureCourseFree(100L, course));
        assertEquals("MEMBER_SCHEDULE_CONFLICT", ex.getErrorCode());
        assertTrue(ex.getMessage().contains("Yoga"));
        verify(sessions, times(1)).findActiveByMemberBetween(100L, d1, d2);
        verify(coachBookings, times(1)).findFutureConfirmedByMember(100L, d1);
    }
}
