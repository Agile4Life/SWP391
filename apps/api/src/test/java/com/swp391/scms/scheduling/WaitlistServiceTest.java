package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.WaitlistDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.ClassWaitlist;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.ClassWaitlistRepository;
import com.swp391.scms.scheduling.service.WaitlistService;
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
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WaitlistServiceTest {

    @Mock
    private ClassWaitlistRepository waitlists;
    @Mock
    private ClassEnrollmentRepository enrollments;
    @Mock
    private ClassSessionRepository sessions;
    @Mock
    private MembershipSubscriptionRepository subscriptions;
    @Mock
    private MemberRepository members;

    // Fixed clock: 2026-10-16 10:00:00 UTC
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-16T10:00:00Z"), ZoneId.of("UTC"));

    private WaitlistService service;
    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member01", "MEMBER");
    private Member member;
    private GymClass gymClass;
    private ClassSession session;

    @BeforeEach
    void setUp() {
        service = new WaitlistService(waitlists, enrollments, sessions, subscriptions, members, clock);

        member = new Member();
        member.setUserId(10L);

        gymClass = new GymClass();
        gymClass.setName("Pilates");
        gymClass.setCapacity(10);

        session = new ClassSession();
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 16));
        session.setStartTime(LocalTime.of(14, 0));
        session.setEndTime(LocalTime.of(15, 0));
        session.setStatus("scheduled");
    }

    @Test
    @DisplayName("join rejects when session is cancelled")
    void join_rejectsCancelledSession() {
        session.setStatus("cancelled");
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.join(principal, 1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("This session has been cancelled");
    }

    @Test
    @DisplayName("join rejects when session is completed")
    void join_rejectsCompletedSession() {
        session.setStatus("completed");
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.join(principal, 1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("This session is not open for waitlist");
    }

    @Test
    @DisplayName("join rejects when session is in the past")
    void join_rejectsPastSession() {
        // Clock is at 10:00:00, session was at 08:00:00 today
        session.setStartTime(LocalTime.of(8, 0));
        session.setEndTime(LocalTime.of(9, 0));
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.join(principal, 1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Cannot join waitlist for a session that has already passed");
    }

    @Test
    @DisplayName("join rejects when member subscription only starts in the future")
    void join_rejectsMembershipWithFutureStartDate() {
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        LocalDate today = LocalDate.of(2026, 10, 16);
        // exists with startDate <= today <= endDate returns false because start_date is tomorrow
        when(subscriptions.existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                10L, "active", today, today)).thenReturn(false);

        assertThatThrownBy(() -> service.join(principal, 1L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Member has no active or unexpired subscription");
    }

    @Test
    @DisplayName("join rejects when class still has space")
    void join_rejectsWhenClassStillHasSpace() {
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        LocalDate today = LocalDate.of(2026, 10, 16);
        when(subscriptions.existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                10L, "active", today, today)).thenReturn(true);

        when(enrollments.countBySessionIdAndStatus(session.getId(), "booked")).thenReturn(5L); // capacity is 10

        assertThatThrownBy(() -> service.join(principal, 1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Session still has seats; book directly instead");
    }

    @Test
    @DisplayName("join succeeds when session is scheduled & upcoming, membership active today, and class full")
    void join_succeedsWhenAllValid() {
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(sessions.findById(1L)).thenReturn(Optional.of(session));

        LocalDate today = LocalDate.of(2026, 10, 16);
        when(subscriptions.existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                10L, "active", today, today)).thenReturn(true);

        when(enrollments.countBySessionIdAndStatus(session.getId(), "booked")).thenReturn(10L); // full
        when(waitlists.saveAndFlush(any(ClassWaitlist.class))).thenAnswer(i -> {
            ClassWaitlist w = i.getArgument(0);
            return w;
        });

        WaitlistDto dto = service.join(principal, 1L);
        assertThat(dto).isNotNull();
        assertThat(dto.status()).isEqualTo("waiting");
        assertThat(dto.sessionId()).isEqualTo(session.getId());
    }
}
