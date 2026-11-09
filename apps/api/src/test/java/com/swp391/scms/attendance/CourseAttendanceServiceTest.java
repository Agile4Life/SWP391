package com.swp391.scms.attendance;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.swp391.scms.attendance.entity.SessionAttendance;
import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.attendance.service.CourseAttendanceService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CourseAttendanceServiceTest {
    private final SessionAttendanceRepository attendance = mock(SessionAttendanceRepository.class);
    private final ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    // 2026-11-09 20:00 Asia/Ho_Chi_Minh
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T13:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private CourseAttendanceService service;
    private GymClass course;
    private Member member;

    @BeforeEach
    void setUp() {
        service = new CourseAttendanceService(attendance, sessions, enrollments, members, clock);
        Coach coach = new Coach();
        course = new GymClass();
        course.setId(5L);
        course.setCoach(coach);
        member = new Member();
        member.setUserId(100L);
    }

    private ClassSession session(long id, LocalDate date, LocalTime start, LocalTime end) {
        ClassSession s = new ClassSession();
        s.setId(id);
        s.setGymClass(course);
        s.setSessionDate(date);
        s.setStartTime(start);
        s.setEndTime(end);
        return s;
    }

    private ClassEnrollment enrollment(LocalDateTime enrolledAt) {
        ClassEnrollment e = new ClassEnrollment();
        e.setGymClass(course);
        e.setMember(member);
        e.setEnrolledAt(enrolledAt);
        return e;
    }

    @Test
    void anUnrecordedFinishedSessionBecomesAnAbsence() {
        ClassSession done = session(1, LocalDate.of(2026, 11, 9), LocalTime.of(17, 0), LocalTime.of(18, 0));
        when(sessions.findNotCancelledBetween(any(), any())).thenReturn(List.of(done));
        when(enrollments.findByGymClassIdAndStatus(5L, "booked")).thenReturn(List.of(enrollment(LocalDateTime.of(2026, 11, 1, 9, 0))));
        when(attendance.existsBySessionIdAndMemberUserId(1L, 100L)).thenReturn(false);
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(9L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(1L);

        assertEquals(1, service.markMissedSessions());

        ArgumentCaptor<SessionAttendance> saved = ArgumentCaptor.forClass(SessionAttendance.class);
        verify(attendance).save(saved.capture());
        assertEquals("absent", saved.getValue().getStatus());
        assertSame(course.getCoach(), saved.getValue().getRecordedBy());
        assertNull(member.getCourseEnrollBlockedUntil());
    }

    @Test
    void sessionsThatHaveNotEndedRecordedOrBeforeTheEnrollmentAreSkipped() {
        ClassSession running = session(1, LocalDate.of(2026, 11, 9), LocalTime.of(19, 0), LocalTime.of(21, 0));
        ClassSession recorded = session(2, LocalDate.of(2026, 11, 8), LocalTime.of(17, 0), LocalTime.of(18, 0));
        ClassSession beforeJoining = session(3, LocalDate.of(2026, 11, 2), LocalTime.of(17, 0), LocalTime.of(18, 0));
        when(sessions.findNotCancelledBetween(any(), any())).thenReturn(List.of(running, recorded, beforeJoining));
        when(enrollments.findByGymClassIdAndStatus(5L, "booked")).thenReturn(List.of(enrollment(LocalDateTime.of(2026, 11, 5, 9, 0))));
        when(attendance.existsBySessionIdAndMemberUserId(2L, 100L)).thenReturn(true);

        assertEquals(0, service.markMissedSessions());
        verify(attendance, never()).save(any());
    }

    @Test
    void missingMoreThanHalfBlocksNewCoursesForThirtyDays() {
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(9L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(5L);
        when(members.findById(100L)).thenReturn(Optional.of(member));

        assertTrue(service.evaluate(100L, 5L));

        assertEquals(LocalDateTime.of(2026, 12, 9, 20, 0), member.getCourseEnrollBlockedUntil());
        verify(members).save(member);
    }

    @Test
    void exactlyHalfIsNotEnoughToBlock() {
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(8L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(4L);

        assertFalse(service.evaluate(100L, 5L));
        verify(members, never()).findById(anyLong());
    }

    @Test
    void anExistingBlockIsNotExtendedAgain() {
        LocalDateTime already = LocalDateTime.of(2026, 12, 1, 8, 0);
        member.setCourseEnrollBlockedUntil(already);
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(4L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(3L);
        when(members.findById(eq(100L))).thenReturn(Optional.of(member));

        assertTrue(service.evaluate(100L, 5L));
        assertEquals(already, member.getCourseEnrollBlockedUntil());
        verify(members, never()).save(any());
    }
}
