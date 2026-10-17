package com.swp391.scms.scheduling;

import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.scheduling.dto.ClassEnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.service.ClassEnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassEnrollmentServiceTest {

    @Mock
    private ClassEnrollmentRepository enrollmentRepository;

    @Mock
    private ClassSessionRepository sessionRepository;

    private ClassEnrollmentService service;

    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member01", "MEMBER");

    @BeforeEach
    void setUp() {
        service = new ClassEnrollmentService(enrollmentRepository, sessionRepository);
    }

    private ClassEnrollment createEnrollment(Long id, Long classId, String className, String coachName,
                                             String roomName, String status) {
        User coachUser = new User();
        coachUser.setFullName(coachName);

        Coach coach = new Coach();
        coach.setUser(coachUser);

        Room room = new Room();
        room.setName(roomName);

        GymClass gymClass = new GymClass();
        ReflectionTestUtils.setField(gymClass, "id", classId);
        gymClass.setName(className);
        gymClass.setCoach(coach);
        gymClass.setRoom(room);

        Member member = new Member();
        member.setUserId(principal.id());

        ClassEnrollment enrollment = new ClassEnrollment();
        ReflectionTestUtils.setField(enrollment, "id", id);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus(status);
        enrollment.setEnrolledAt(LocalDateTime.now().minusDays(1));

        return enrollment;
    }

    private ClassSession createSession(Long id, GymClass gymClass, LocalDate date, LocalTime start, LocalTime end) {
        ClassSession session = new ClassSession();
        ReflectionTestUtils.setField(session, "id", id);
        session.setGymClass(gymClass);
        session.setSessionDate(date);
        session.setStartTime(start);
        session.setEndTime(end);
        session.setStatus("scheduled");
        return session;
    }

    @Test
    @DisplayName("getMyEnrollments should return mapped DTOs with batch loaded session information")
    void shouldReturnMappedDtosWithBatchSessions() {
        ClassEnrollment e1 = createEnrollment(1L, 100L, "Pilates Core", "Lê HLV", "Phòng 101", "booked");
        ClassEnrollment e2 = createEnrollment(2L, 101L, "Boxing Pro", "Trần HLV", "Phòng 202", "booked");

        when(enrollmentRepository.findByMemberUserIdWithDetails(10L, null))
                .thenReturn(List.of(e1, e2));

        ClassSession s1 = createSession(10L, e1.getGymClass(), LocalDate.now().plusDays(2), LocalTime.of(9, 0), LocalTime.of(10, 0));
        ClassSession s2 = createSession(11L, e2.getGymClass(), LocalDate.now().plusDays(3), LocalTime.of(14, 0), LocalTime.of(15, 0));

        when(sessionRepository.findByGymClassIdIn(anyCollection()))
                .thenReturn(List.of(s1, s2));

        List<ClassEnrollmentDto> results = service.getMyEnrollments(principal, null, null);

        assertEquals(2, results.size());

        ClassEnrollmentDto dto1 = results.get(0);
        assertEquals(1L, dto1.getId());
        assertEquals(100L, dto1.getClassId());
        assertEquals("Pilates Core", dto1.getClassName());
        assertEquals("Lê HLV", dto1.getCoachName());
        assertEquals("Phòng 101", dto1.getRoomName());
        assertEquals(LocalDate.now().plusDays(2), dto1.getSessionDate());
        assertEquals(LocalTime.of(9, 0), dto1.getStartTime());
        assertEquals(LocalTime.of(10, 0), dto1.getEndTime());
        assertEquals("booked", dto1.getStatus());

        verify(sessionRepository).findByGymClassIdIn(List.of(100L, 101L));
    }

    @Test
    @DisplayName("getMyEnrollments should filter upcoming enrollments correctly")
    void shouldFilterUpcomingEnrollments() {
        ClassEnrollment eUpcoming = createEnrollment(1L, 100L, "Yoga", "HLV A", "Phòng A", "booked");
        ClassEnrollment ePast = createEnrollment(2L, 101L, "Gym", "HLV B", "Phòng B", "completed");

        when(enrollmentRepository.findByMemberUserIdWithDetails(10L, null))
                .thenReturn(List.of(eUpcoming, ePast));

        ClassSession sUpcoming = createSession(10L, eUpcoming.getGymClass(), LocalDate.now().plusDays(1), LocalTime.of(9, 0), LocalTime.of(10, 0));
        ClassSession sPast = createSession(11L, ePast.getGymClass(), LocalDate.now().minusDays(5), LocalTime.of(9, 0), LocalTime.of(10, 0));

        when(sessionRepository.findByGymClassIdIn(anyCollection()))
                .thenReturn(List.of(sUpcoming, sPast));

        List<ClassEnrollmentDto> upcomingList = service.getMyEnrollments(principal, null, true);
        assertEquals(1, upcomingList.size());
        assertEquals("Yoga", upcomingList.get(0).getClassName());

        List<ClassEnrollmentDto> historyList = service.getMyEnrollments(principal, null, false);
        assertEquals(1, historyList.size());
        assertEquals("Gym", historyList.get(0).getClassName());
    }

    @Test
    @DisplayName("getMyEnrollments should return empty list when principal is null")
    void shouldReturnEmptyWhenPrincipalNull() {
        List<ClassEnrollmentDto> results = service.getMyEnrollments(null, null, null);
        assertTrue(results.isEmpty());
    }
}
