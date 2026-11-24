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

/** Bộ kiểm thử cho service CourseAttendanceService (course attendance service). */
class CourseAttendanceServiceTest {
    private final SessionAttendanceRepository attendance = mock(SessionAttendanceRepository.class);
    private final ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    // 2026-11-09 20:00 (múi giờ Asia/Ho_Chi_Minh)
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T13:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private CourseAttendanceService service;
    private GymClass course;
    private Member member;

    /** Chuẩn bị trước mỗi test: tạo service điểm danh khóa học với repository giả lập. */
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

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (session). */
    private ClassSession session(long id, LocalDate date, LocalTime start, LocalTime end) {
        ClassSession s = new ClassSession();
        s.setId(id);
        s.setGymClass(course);
        s.setSessionDate(date);
        s.setStartTime(start);
        s.setEndTime(end);
        return s;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (enrollment). */
    private ClassEnrollment enrollment(LocalDateTime enrolledAt) {
        ClassEnrollment e = new ClassEnrollment();
        e.setGymClass(course);
        e.setMember(member);
        e.setEnrolledAt(enrolledAt);
        return e;
    }

    /** Kiểm thử: lượt quét tự động không làm gì khi lớp nhóm đã ngừng hoạt động. */
    @Test
    void sweepDoesNothingWhileGroupClassesAreOutOfScope() {
        service.sweep();

        verifyNoInteractions(sessions);
    }

    /** Kiểm thử: buổi đã kết thúc mà chưa được ghi nhận sẽ thành vắng mặt. */
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

    /** Kiểm thử: hội viên có mặt tại trung tâm trong giờ học được để lại cho HLV, không tự đánh dấu. */
    @Test
    void aMemberWhoWasInTheCenterDuringTheSessionIsLeftForTheCoachNotAutoMarked() {
        com.swp391.scms.attendance.repository.CenterCheckinRepository checkins =
                mock(com.swp391.scms.attendance.repository.CenterCheckinRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "checkins", checkins);
        ClassSession done = session(1, LocalDate.of(2026, 11, 9), LocalTime.of(17, 0), LocalTime.of(18, 0));
        when(sessions.findNotCancelledBetween(any(), any())).thenReturn(List.of(done));
        when(enrollments.findByGymClassIdAndStatus(5L, "booked")).thenReturn(List.of(enrollment(LocalDateTime.of(2026, 11, 1, 9, 0))));
        when(attendance.existsBySessionIdAndMemberUserId(1L, 100L)).thenReturn(false);
        // Hội viên vào lúc 15:30, sớm hơn giờ bắt đầu 17:00 quá 30 phút, và chưa rời khỏi trung tâm.
        when(checkins.findCoveringVisitStart(100L, LocalDateTime.of(2026, 11, 9, 14, 0),
                LocalDateTime.of(2026, 11, 9, 17, 0), LocalDateTime.of(2026, 11, 9, 18, 0)))
                .thenReturn(LocalDateTime.of(2026, 11, 9, 15, 30));

        assertEquals(0, service.markMissedSessions());
        verify(attendance, never()).save(any());
    }

    /** Kiểm thử: bỏ qua buổi chưa kết thúc, đã ghi nhận hoặc diễn ra trước khi ghi danh. */
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

    /** Kiểm thử: quay lại học sớm sẽ nhả phần tạm hoãn và miễn vắng từ ngày đó. */
    @Test
    void resumingEarlyReleasesTheHoldExcusesFromThatDayOn() {
        SessionAttendance excused = new SessionAttendance();
        when(attendance.findHoldExcuses(100L, LocalDate.of(2026, 11, 12))).thenReturn(List.of(excused));

        assertEquals(1, service.releaseHoldExcuses(100L, LocalDate.of(2026, 11, 12)));

        verify(attendance).deleteAll(List.of(excused));
    }

    /** Kiểm thử: vắng hơn một nửa khóa thì bị chặn đăng ký khóa mới trong 30 ngày. */
    @Test
    void missingMoreThanHalfBlocksNewCoursesForThirtyDays() {
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(9L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(5L);
        when(members.findById(100L)).thenReturn(Optional.of(member));

        assertTrue(service.evaluate(100L, 5L));

        assertEquals(LocalDateTime.of(2026, 12, 9, 20, 0), member.getCourseEnrollBlockedUntil());
        verify(members).save(member);
    }

    /** Kiểm thử: vắng đúng một nửa thì chưa đủ để bị chặn. */
    @Test
    void exactlyHalfIsNotEnoughToBlock() {
        when(sessions.countByGymClassIdAndStatusNot(5L, "cancelled")).thenReturn(8L);
        when(attendance.countAbsences(100L, 5L)).thenReturn(4L);

        assertFalse(service.evaluate(100L, 5L));
        verify(members, never()).findById(anyLong());
    }

    /** Kiểm thử: lệnh chặn đang có hiệu lực không bị gia hạn thêm lần nữa. */
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
