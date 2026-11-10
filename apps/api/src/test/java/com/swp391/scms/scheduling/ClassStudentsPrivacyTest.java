package com.swp391.scms.scheduling;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.ClassService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Health notes are medical data: only the class's own coach and managers read them. */
class ClassStudentsPrivacyTest {
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private ClassService service;

    @BeforeEach
    void setUp() {
        service = new ClassService(gymClasses, sessions, enrollments, mock(DisciplineRepository.class), mock(CoachRepository.class),
                mock(RoomRepository.class), new SchedulingMapper(), Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
        Coach coach = new Coach();
        coach.setUserId(20L);
        GymClass gymClass = new GymClass();
        gymClass.setId(5L);
        gymClass.setCoach(coach);
        when(gymClasses.findById(5L)).thenReturn(Optional.of(gymClass));
        when(gymClasses.existsById(5L)).thenReturn(true);
        User user = new User();
        user.setId(100L);
        user.setFullName("Khoa");
        Member member = new Member();
        member.setUserId(100L);
        member.setUser(user);
        member.setHealthNotes("Tiền sử tim mạch");
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassId(5L)).thenReturn(List.of(enrollment));
    }

    @Test
    void theClassCoachAndManagersSeeTheHealthNotes() {
        assertEquals("Tiền sử tim mạch", service.getClassStudents(5L, new AuthenticatedPrincipal(20L, "hung", "COACH")).get(0).healthNotes());
        assertEquals("Tiền sử tim mạch", service.getClassStudents(5L, new AuthenticatedPrincipal(1L, "mgr", "CENTER_MANAGER")).get(0).healthNotes());
    }

    @Test
    void anotherCoachCannotReadTheStudentsOfAClassThatIsNotTheirs() {
        assertThrows(ForbiddenException.class, () -> service.getClassStudents(5L, new AuthenticatedPrincipal(99L, "other", "COACH")));
    }

    @Test
    void theDeskGetsContactDetailsWithoutTheMedicalNotes() {
        var student = service.getClassStudents(5L, new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST")).get(0);

        assertEquals("Khoa", student.fullName());
        assertEquals("", student.healthNotes());
    }
}
