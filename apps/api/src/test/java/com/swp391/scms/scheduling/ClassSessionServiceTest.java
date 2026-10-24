package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.notifications.event.SessionCancelledEvent;
import com.swp391.scms.scheduling.dto.CancelSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.service.ClassSessionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClassSessionServiceTest {

    @Mock private ClassSessionRepository sessionRepository;
    @Mock private ClassEnrollmentRepository enrollmentRepository;
    @Mock private MembershipSubscriptionRepository subscriptionRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private MessageService messageService;
    @Mock private Clock clock;

    @InjectMocks
    private ClassSessionService sessionService;

    private ClassSession session;
    private GymClass gymClass;
    private Coach coach;
    private Member member;
    private ClassEnrollment enrollment;
    private AuthenticatedPrincipal coachPrincipal;
    private AuthenticatedPrincipal managerPrincipal;

    @BeforeEach
    void setUp() {
        lenient().when(clock.instant()).thenReturn(Instant.parse("2026-10-25T08:00:00Z"));
        lenient().when(clock.getZone()).thenReturn(ZoneOffset.UTC);

        coachPrincipal = new AuthenticatedPrincipal(10L, "coach@test.com", "COACH");
        managerPrincipal = new AuthenticatedPrincipal(1L, "manager@test.com", "CENTER_MANAGER");

        User coachUser = new User();
        ReflectionTestUtils.setField(coachUser, "id", 10L);
        coachUser.setFullName("Coach Mike");

        coach = new Coach();
        coach.setUserId(10L);
        coach.setUser(coachUser);

        User memberUser = new User();
        ReflectionTestUtils.setField(memberUser, "id", 20L);
        memberUser.setFullName("Student Alice");

        member = new Member();
        member.setUserId(20L);
        member.setUser(memberUser);

        Discipline discipline = new Discipline();
        ReflectionTestUtils.setField(discipline, "id", 3L);
        discipline.setName("Fitness");

        Room room = new Room();
        ReflectionTestUtils.setField(room, "id", 4L);
        room.setName("Main Hall");

        gymClass = new GymClass();
        ReflectionTestUtils.setField(gymClass, "id", 5L);
        gymClass.setName("Cardio HIIT");
        gymClass.setCoach(coach);
        gymClass.setDiscipline(discipline);
        gymClass.setRoom(room);
        gymClass.setCapacity(20);

        session = new ClassSession();
        ReflectionTestUtils.setField(session, "id", 100L);
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 26));
        session.setStartTime(LocalTime.of(10, 0));
        session.setEndTime(LocalTime.of(11, 0));
        session.setStatus("scheduled");

        enrollment = new ClassEnrollment();
        ReflectionTestUtils.setField(enrollment, "id", 200L);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
    }

    @Test
    void cancelSession_byAssignedCoach_success() {
        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(sessionRepository.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> i.getArgument(0));
        when(enrollmentRepository.findByGymClassId(5L)).thenReturn(List.of(enrollment));

        MembershipSubscription activeSub = new MembershipSubscription();
        ReflectionTestUtils.setField(activeSub, "id", 300L);
        activeSub.setStatus("active");
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusOrderByEndDateDesc(20L, "active"))
                .thenReturn(Optional.of(activeSub));

        CancelSessionRequest request = new CancelSessionRequest("Coach has medical emergency");

        ClassSessionDto dto = sessionService.cancelSession(100L, request, coachPrincipal);

        assertNotNull(dto);
        assertEquals("cancelled", dto.status());
        assertEquals("Coach has medical emergency", dto.cancelReason());
        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("Coach has medical emergency", enrollment.getCancelReason());

        // Verify notification sent
        verify(notificationService, times(1)).send(
                eq(20L), any(), any(), eq("schedule_change"), eq("class_session"), eq(100L));

        // Verify event published
        ArgumentCaptor<SessionCancelledEvent> captor = ArgumentCaptor.forClass(SessionCancelledEvent.class);
        verify(eventPublisher, times(1)).publishEvent(captor.capture());
        assertEquals(100L, captor.getValue().sessionId());
        assertEquals(List.of(20L), captor.getValue().affectedMemberUserIds());
    }

    @Test
    void cancelSession_alreadyCancelled_throwsConflictException() {
        session.setStatus("cancelled");
        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));

        CancelSessionRequest request = new CancelSessionRequest("Weather issue");

        assertThrows(ConflictException.class, () -> sessionService.cancelSession(100L, request, coachPrincipal));
    }

    @Test
    void cancelSession_byUnassignedCoach_throwsForbiddenException() {
        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        AuthenticatedPrincipal otherCoach = new AuthenticatedPrincipal(99L, "other@coach.com", "COACH");

        CancelSessionRequest request = new CancelSessionRequest("Should fail");

        assertThrows(ForbiddenException.class, () -> sessionService.cancelSession(100L, request, otherCoach));
    }

    @Test
    void cancelSession_notFound_throwsResourceNotFoundException() {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        CancelSessionRequest request = new CancelSessionRequest("Should fail");

        assertThrows(ResourceNotFoundException.class, () -> sessionService.cancelSession(999L, request, managerPrincipal));
    }
}
