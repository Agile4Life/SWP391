package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock
    private ClassEnrollmentRepository enrollments;
    @Mock
    private ClassSessionRepository sessions;
    @Mock
    private MembershipSubscriptionRepository subscriptions;
    @Mock
    private MemberRepository members;
    @Mock
    private NotificationService notifications;

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-16T10:00:00Z"), ZoneId.of("UTC"));

    private EnrollmentService service;
    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member01", "MEMBER");
    private Member member;
    private GymClass gymClass;
    private ClassSession session1;
    private ClassSession session2;

    @BeforeEach
    void setUp() {
        service = new EnrollmentService(
                enrollments,
                sessions,
                subscriptions,
                members,
                notifications,
                null,
                clock
        );

        member = new Member();
        member.setUserId(10L);

        gymClass = new GymClass();
        gymClass.setId(5L);
        gymClass.setName("Yoga Morning");
        gymClass.setCapacity(20);

        session1 = new ClassSession();
        session1.setId(101L);
        session1.setGymClass(gymClass);
        session1.setSessionDate(LocalDate.of(2026, 10, 17));
        session1.setStartTime(LocalTime.of(8, 0));
        session1.setEndTime(LocalTime.of(9, 0));
        session1.setStatus("scheduled");

        session2 = new ClassSession();
        session2.setId(102L);
        session2.setGymClass(gymClass);
        session2.setSessionDate(LocalDate.of(2026, 10, 18));
        session2.setStartTime(LocalTime.of(8, 0));
        session2.setEndTime(LocalTime.of(9, 0));
        session2.setStatus("scheduled");
    }

    private void mockActiveMembership() {
        LocalDate today = LocalDate.of(2026, 10, 16);
        when(subscriptions.existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                10L, "active", today, today)).thenReturn(true);
    }

    @Test
    @DisplayName("Đặt 2 buổi khác nhau trong cùng 1 lớp thành công (không bị duplicate theo classId)")
    void enroll_allowsMemberToBookTwoDifferentSessionsOfSameClass() {
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(101L)).thenReturn(Optional.of(session1));
        when(sessions.findById(102L)).thenReturn(Optional.of(session2));
        mockActiveMembership();

        when(enrollments.findBySessionIdAndMemberUserIdAndStatus(101L, 10L, "booked")).thenReturn(Optional.empty());
        when(enrollments.findBySessionIdAndMemberUserIdAndStatus(102L, 10L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countBySessionIdAndStatus(101L, "booked")).thenReturn(5L);
        when(enrollments.countBySessionIdAndStatus(102L, "booked")).thenReturn(8L);

        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenAnswer(i -> {
            ClassEnrollment e = i.getArgument(0);
            e.setId(1L);
            return e;
        });

        EnrollmentDto dto1 = service.enroll(principal, 101L);
        EnrollmentDto dto2 = service.enroll(principal, 102L);

        assertThat(dto1).isNotNull();
        assertThat(dto1.status()).isEqualTo("booked");
        assertThat(dto1.sessionId()).isEqualTo(session1.getId());

        assertThat(dto2).isNotNull();
        assertThat(dto2.status()).isEqualTo("booked");
        assertThat(dto2.sessionId()).isEqualTo(session2.getId());
    }

    @Test
    @DisplayName("Từ chối nếu hội viên đã đặt chính buổi học đó trước đó")
    void enroll_rejectsWhenAlreadyEnrolledInSameSession() {
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(101L)).thenReturn(Optional.of(session1));
        mockActiveMembership();

        ClassEnrollment existing = new ClassEnrollment();
        existing.setStatus("booked");
        when(enrollments.findBySessionIdAndMemberUserIdAndStatus(101L, 10L, "booked")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.enroll(principal, 101L))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Member already has an active booking for this session");
    }

    @Test
    @DisplayName("Tranh chấp suất cuối: từ chối khi buổi học đã đạt tối đa capacity")
    void enroll_rejectsWhenSessionCapacityIsReached() {
        gymClass.setCapacity(1); // Chỉ còn 1 chỗ
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(101L)).thenReturn(Optional.of(session1));
        mockActiveMembership();

        when(enrollments.findBySessionIdAndMemberUserIdAndStatus(101L, 10L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countBySessionIdAndStatus(101L, "booked")).thenReturn(1L); // Đã có 1 người đặt

        assertThatThrownBy(() -> service.enroll(principal, 101L))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Class is full; consider joining the waitlist");
    }

    @Test
    @DisplayName("Hủy đúng buổi: hủy buổi 1 thì chỉ cập nhật trạng thái của buổi 1 thành cancelled")
    void cancel_cancelsCorrectSessionEnrollment() {
        ClassEnrollment enrollment1 = new ClassEnrollment();
        enrollment1.setId(50L);
        enrollment1.setGymClass(gymClass);
        enrollment1.setSession(session1);
        enrollment1.setMember(member);
        enrollment1.setStatus("booked");

        when(enrollments.findById(50L)).thenReturn(Optional.of(enrollment1));
        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenAnswer(i -> i.getArgument(0));

        EnrollmentDto cancelled = service.cancel(principal, 50L);

        assertThat(cancelled).isNotNull();
        assertThat(cancelled.status()).isEqualTo("cancelled");
        assertThat(cancelled.sessionId()).isEqualTo(session1.getId());
        verify(enrollments).saveAndFlush(enrollment1);
    }

    @Test
    @DisplayName("myEnrollments trả về danh sách có đầy đủ thông tin buổi học thực tế")
    void myEnrollments_returnsBookedSessionsWithSessionDetails() {
        ClassEnrollment enrollment1 = new ClassEnrollment();
        enrollment1.setId(1L);
        enrollment1.setGymClass(gymClass);
        enrollment1.setSession(session1);
        enrollment1.setMember(member);
        enrollment1.setStatus("booked");
        enrollment1.setEnrolledAt(LocalDateTime.now(clock));

        when(enrollments.findByMemberUserIdWithDetails(10L, null)).thenReturn(List.of(enrollment1));

        List<EnrollmentDto> list = service.myEnrollments(principal, null);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).sessionId()).isEqualTo(session1.getId());
        assertThat(list.get(0).sessionDate()).isEqualTo(session1.getSessionDate());
        assertThat(list.get(0).startTime()).isEqualTo(session1.getStartTime());
    }
}
