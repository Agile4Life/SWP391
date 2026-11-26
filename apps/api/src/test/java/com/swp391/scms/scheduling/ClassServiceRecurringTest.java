package com.swp391.scms.scheduling;

import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.BadRequestException;
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

/** Bộ kiểm thử cho ClassServiceRecurring (class service recurring). */
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

    /** Chuẩn bị trước mỗi test: tạo ClassService với repository giả lập. */
    @BeforeEach
    void setUp() {
        classService = new ClassService(gymClasses, sessions, enrollments, disciplines, coaches, rooms, mapper, clock);
    }

    /** Kiểm thử: tạo lớp định kỳ thành công và sinh các buổi theo lịch. */
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

        // Lịch mở trước: sau 3 tuần (2026-11-30 đến 2026-12-11), Thứ 2 & Thứ 4 = 4 buổi học
        CreateRecurringClassRequest req = new CreateRecurringClassRequest(
                "Yoga Advance", 1L, 2L, 3L, 20, "beginner", "Description",
                new BigDecimal("500000"),
                LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11),
                List.of("MONDAY", "WEDNESDAY"),
                ScheduleSlot.SLOT_1.startTime(), ScheduleSlot.SLOT_1.endTime()
        );

        GymClassDto result = classService.createRecurringClass(req);

        assertNotNull(result);
        assertEquals(10L, result.id());
        verify(sessions, atLeast(4)).saveAndFlush(any(ClassSession.class));
    }

    /** Hàm trợ giúp của test: giả lập danh mục (phòng, bộ môn, HLV) cho việc tạo lớp. */
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

    /** Hàm trợ giúp của test: lấy các ngày buổi học đã được lưu. */
    private List<LocalDate> savedDates() {
        var captor = org.mockito.ArgumentCaptor.forClass(ClassSession.class);
        verify(sessions, atLeastOnce()).saveAndFlush(captor.capture());
        return captor.getAllValues().stream().map(ClassSession::getSessionDate).sorted().toList();
    }

    /** Kiểm thử: khóa học hằng tuần diễn ra vào các thứ đã chọn mỗi tuần. */
    @Test
    void aWeeklyCourseMeetsOnTheChosenWeekdaysEveryWeek() {
        stubCatalog();

        GymClassDto result = classService.createRecurringClass(new CreateRecurringClassRequest("Yoga", 1L, 2L, 3L, 20, "all", null,
                BigDecimal.ZERO, LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 13), List.of("MONDAY", "WEDNESDAY"),
                ScheduleSlot.SLOT_1.startTime(), ScheduleSlot.SLOT_1.endTime()));

        assertEquals("MONDAY,WEDNESDAY", result.recurringDays());
        assertEquals(List.of(LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 2), LocalDate.of(2026, 12, 7),
                LocalDate.of(2026, 12, 9)), savedDates());
    }

    /** Kiểm thử: khóa học hằng tuần vẫn bắt buộc chọn thứ trong tuần. */
    @Test
    void aWeeklyCourseStillNeedsWeekdays() {
        stubCatalog();
        CreateRecurringClassRequest weeklyWithoutDays = new CreateRecurringClassRequest("Yoga", 1L, 2L, 3L, 20, "all", null,
                BigDecimal.ZERO, LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11), List.of(),
                ScheduleSlot.SLOT_1.startTime(), ScheduleSlot.SLOT_1.endTime());
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> classService.createRecurringClass(weeklyWithoutDays));
        assertEquals("SCHEDULING_NO_RECURRING_DAYS", ex.getErrorCode());
    }

    /** Kiểm thử: từ chối khóa học định kỳ có khung giờ ngoài 5 slot cố định. */
    @Test
    void rejectsRecurringClassOutsideFiveCanonicalSlots() {
        stubCatalog();
        for (LocalTime[] invalid : new LocalTime[][]{
                {LocalTime.of(8, 0), LocalTime.of(9, 0)},
                {LocalTime.of(7, 0), LocalTime.of(9, 0)},
                {LocalTime.of(19, 30), LocalTime.of(20, 30)}
        }) {
            CreateRecurringClassRequest req = new CreateRecurringClassRequest("Yoga", 1L, 2L, 3L, 20, "all", null,
                    BigDecimal.ZERO, LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11), List.of("MONDAY"),
                    invalid[0], invalid[1]);
            BadRequestException ex = assertThrows(BadRequestException.class,
                    () -> classService.createRecurringClass(req));
            assertEquals("SCHEDULING_INVALID_SLOT", ex.getErrorCode());
            assertEquals("error.scheduling.invalid_slot", ex.getMessageKey());
        }
        verify(gymClasses, never()).save(any());
        verify(sessions, never()).saveAndFlush(any());
    }
}
