package com.swp391.scms.scheduling;

import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.ClassService;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClassServiceRecurringTest {

    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private DisciplineRepository disciplines = mock(DisciplineRepository.class);
    private CoachRepository coaches = mock(CoachRepository.class);
    private RoomRepository rooms = mock(RoomRepository.class);
    private SchedulingMapper mapper = new SchedulingMapper();
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private ClassService classService;

    @BeforeEach
    void setUp() {
        classService = new ClassService(gymClasses, sessions, enrollments, disciplines, coaches, rooms, mapper, clock);
    }

    @Test
    void testCreateRecurringClassSuccess() {
        Discipline discipline = mock(Discipline.class);
        when(discipline.getId()).thenReturn(1L);
        when(discipline.getName()).thenReturn("Yoga");
        when(disciplines.findById(1L)).thenReturn(Optional.of(discipline));

        Coach coach = new Coach();
        coach.setUserId(2L);
        coach.setEmploymentStatus("active");
        when(coaches.findById(2L)).thenReturn(Optional.of(coach));

        Room room = new Room();
        room.setId(3L);
        room.setStatus("available");
        when(rooms.findById(3L)).thenReturn(Optional.of(room));

        when(gymClasses.save(any(GymClass.class))).thenAnswer(invocation -> {
            GymClass c = invocation.getArgument(0);
            c.setId(10L);
            return c;
        });

        // Advance schedule: 3 weeks later (2026-11-30 to 2026-12-11), Mon & Wed = 4 sessions
        CreateRecurringClassRequest req = new CreateRecurringClassRequest(
                "Yoga Advance", 1L, 2L, 3L, 20, "beginner", "Description",
                new BigDecimal("500000"),
                LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11),
                List.of("MONDAY", "WEDNESDAY"),
                LocalTime.of(7, 0), LocalTime.of(8, 30)
        );

        GymClassDto result = classService.createRecurringClass(req);

        assertNotNull(result);
        assertEquals(10L, result.id());
        verify(sessions, atLeast(4)).saveAndFlush(any(ClassSession.class));
    }

    private void stubCatalog() {
        Discipline discipline = mock(Discipline.class);
        when(discipline.getId()).thenReturn(1L);
        when(discipline.getName()).thenReturn("Yoga");
        when(disciplines.findById(1L)).thenReturn(Optional.of(discipline));
        Coach coach = new Coach();
        coach.setUserId(2L);
        coach.setEmploymentStatus("active");
        when(coaches.findById(2L)).thenReturn(Optional.of(coach));
        Room room = new Room();
        room.setId(3L);
        room.setStatus("available");
        when(rooms.findById(3L)).thenReturn(Optional.of(room));
        when(gymClasses.save(any(GymClass.class))).thenAnswer(invocation -> {
            GymClass c = invocation.getArgument(0);
            c.setId(10L);
            return c;
        });
    }

    private CreateRecurringClassRequest monthly(LocalDate start, LocalDate end, List<Integer> days) {
        return new CreateRecurringClassRequest("Yoga Monthly", 1L, 2L, 3L, 20, "all", null, new BigDecimal("500000"),
                start, end, null, LocalTime.of(7, 0), LocalTime.of(8, 30), "monthly", days);
    }

    private List<LocalDate> savedDates() {
        var captor = org.mockito.ArgumentCaptor.forClass(ClassSession.class);
        verify(sessions, atLeastOnce()).saveAndFlush(captor.capture());
        return captor.getAllValues().stream().map(ClassSession::getSessionDate).sorted().toList();
    }

    @Test
    void aMonthlyCourseMeetsOnTheChosenDaysOfEachMonth() {
        stubCatalog();

        GymClassDto result = classService.createRecurringClass(
                monthly(LocalDate.of(2026, 11, 10), LocalDate.of(2027, 1, 31), List.of(20, 5)));

        assertEquals("monthly", result.repeatType());
        assertEquals("5,20", result.monthDays());
        assertNull(result.recurringDays());
        // Nov 5 is before the start; Nov 20, Dec 5, Dec 20, Jan 5, Jan 20.
        assertEquals(List.of(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 5), LocalDate.of(2026, 12, 20),
                LocalDate.of(2027, 1, 5), LocalDate.of(2027, 1, 20)), savedDates());
    }

    @Test
    void aMonthlyCourseDefaultsToTheDayOfTheStartDateAndClampsShortMonths() {
        stubCatalog();

        classService.createRecurringClass(monthly(LocalDate.of(2026, 11, 30), LocalDate.of(2027, 3, 31), null));

        // The 30th, but February has only 28 days in 2027.
        assertEquals(List.of(LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 30), LocalDate.of(2027, 1, 30),
                LocalDate.of(2027, 2, 28), LocalDate.of(2027, 3, 30)), savedDates());
    }

    @Test
    void aWeeklyCourseStillNeedsWeekdaysAndAMonthlyOneRejectsBadDays() {
        stubCatalog();
        CreateRecurringClassRequest weeklyWithoutDays = new CreateRecurringClassRequest("Yoga", 1L, 2L, 3L, 20, "all", null,
                BigDecimal.ZERO, LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11), List.of(),
                LocalTime.of(7, 0), LocalTime.of(8, 30));
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> classService.createRecurringClass(weeklyWithoutDays));
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> classService.createRecurringClass(monthly(LocalDate.of(2026, 11, 30), LocalDate.of(2027, 1, 31), List.of(40))));
    }
}
