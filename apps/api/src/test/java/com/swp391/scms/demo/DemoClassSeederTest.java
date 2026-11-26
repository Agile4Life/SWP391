package com.swp391.scms.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Coach;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** Bộ kiểm thử cho bộ khởi tạo dữ liệu DemoClassSeeder (demo class seeder). */
@ExtendWith(MockitoExtension.class)
class DemoClassSeederTest {

    @Mock GymClassRepository classes;
    @Mock ClassSessionRepository sessions;
    @Mock CoachRepository coaches;
    @Mock RoomRepository rooms;
    @Mock DisciplineRepository disciplines;
    @Mock UserRepository users;
    @Mock com.swp391.scms.coaching.repository.CoachBookingRepository coachBookings;

    private final List<GymClass> savedClasses = new ArrayList<>();
    private final List<ClassSession> savedSessions = new ArrayList<>();
    private DemoClassSeeder seeder;

    /** Chuẩn bị trước mỗi test: tạo seeder lớp học mẫu với repository giả lập. */
    @BeforeEach
    void setUp() {
        seeder = new DemoClassSeeder(classes, sessions, coaches, rooms, disciplines, users, coachBookings);
        lenient().when(coaches.findActiveWithUser()).thenReturn(List.of(
                coach(1L, "Gym - Sức mạnh"), coach(2L, "Yoga"), coach(3L, "Boxing"), coach(4L, "Yoga & Phục hồi")));
        lenient().when(rooms.findAllByOrderByNameAsc()).thenReturn(List.of(
                room(1L, "Phòng Gym Tiêu chuẩn", 50), room(2L, "Ring Arena 01", 14),
                room(3L, "Zen Garden Studio", 18)));
        lenient().when(disciplines.findAll()).thenReturn(List.of(
                discipline(1L, "Gym"), discipline(2L, "Yoga"), discipline(3L, "Boxing")));
        lenient().when(classes.findAll()).thenReturn(List.of());
        lenient().when(sessions.findNotCancelledBetween(any(), any())).thenReturn(List.of());
        lenient().when(coachBookings.findConfirmedBetween(any(), any())).thenReturn(List.of());
        lenient().when(users.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(any())).thenReturn(List.of());
        lenient().when(classes.save(any())).thenAnswer(call -> {
            GymClass saved = call.getArgument(0);
            savedClasses.add(saved);
            return saved;
        });
        lenient().when(sessions.save(any())).thenAnswer(call -> {
            ClassSession saved = call.getArgument(0);
            savedSessions.add(saved);
            return saved;
        });
    }

    /** Kiểm thử P2-BE-25: tạo đủ khóa đang diễn ra và khóa sắp khai giảng (fromDay > 0) cho cả 3 bộ môn mà không trùng HLV, phòng hay cùng bộ môn. */
    @Test
    void createsOngoingAndUpcomingActiveClassesPerDisciplineWithoutConflicts() {
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

        seeder.run(null);

        assertThat(savedClasses).hasSize(6);
        assertThat(savedClasses)
                .extracting(c -> c.getDiscipline().getName())
                .containsExactlyInAnyOrder("Gym", "Gym", "Boxing", "Boxing", "Yoga", "Yoga");
        // Mỗi bộ môn đều có ít nhất 1 khóa sắp khai giảng (startDate > today) để hội viên đăng ký được ngay
        for (String disciplineName : List.of("Gym", "Boxing", "Yoga")) {
            assertThat(savedClasses.stream()
                    .filter(c -> disciplineName.equals(c.getDiscipline().getName()))
                    .anyMatch(c -> c.getStartDate().isAfter(today)))
                    .as("discipline %s should have an upcoming enrollable course", disciplineName)
                    .isTrue();
        }
        assertThat(savedClasses).allSatisfy(c -> {
            assertThat(c.getStatus()).isEqualTo("active");
            assertThat(c.getStartDate()).isNotNull();
            assertThat(c.getEndTime()).isAfter(c.getStartTime());
            assertThat(ScheduleSlot.isValid(c.getStartTime(), c.getEndTime())).isTrue();
            assertThat(c.getCapacity()).isLessThanOrEqualTo(c.getRoom().getCapacity());
        });
        assertThat(savedSessions).isNotEmpty().allSatisfy(s ->
                assertThat(ScheduleSlot.isValid(s.getStartTime(), s.getEndTime())).isTrue());
        for (ClassSession a : savedSessions) {
            for (ClassSession b : savedSessions) {
                if (a == b || !a.getSessionDate().equals(b.getSessionDate())) {
                    continue;
                }
                boolean overlap = a.getStartTime().isBefore(b.getEndTime()) && a.getEndTime().isAfter(b.getStartTime());
                if (overlap) {
                    assertThat(a.getGymClass().getCoach().getUserId())
                            .as("coach double-booked on %s", a.getSessionDate())
                            .isNotEqualTo(b.getGymClass().getCoach().getUserId());
                    assertThat(a.getGymClass().getRoom().getId())
                            .as("room double-booked on %s", a.getSessionDate())
                            .isNotEqualTo(b.getGymClass().getRoom().getId());
                    assertThat(a.getGymClass().getDiscipline().getId())
                            .as("same discipline overlapped on %s", a.getSessionDate())
                            .isNotEqualTo(b.getGymClass().getDiscipline().getId());
                }
            }
        }
    }

    /**
     * Kiểm thử: không xếp buổi học đè lên lịch PT đã xác nhận của HLV và vẫn chọn đúng 1 trong 5 slot cố định.
     * Trigger lịch học cũng từ chối buổi lớp trùng khung giờ với lịch PT đã xác nhận của cùng HLV.
     */
    @Test
    void doesNotPlaceAScheduledSessionOverAConfirmedPtBookingOfTheCoach() {
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        List<com.swp391.scms.coaching.entity.CoachBooking> bookings = new ArrayList<>();
        for (int day = -100; day <= 100; day++) {
            for (long coachId = 1; coachId <= 4; coachId++) {
                var booking = new com.swp391.scms.coaching.entity.CoachBooking();
                booking.setCoach(coach(coachId, "any"));
                booking.setBookingDate(today.plusDays(day));
                booking.setStartTime(ScheduleSlot.SLOT_5.startTime());
                booking.setEndTime(ScheduleSlot.SLOT_5.endTime());
                bookings.add(booking);
            }
        }
        lenient().when(coachBookings.findConfirmedBetween(any(), any())).thenReturn(bookings);

        seeder.run(null);

        assertThat(savedSessions).isNotEmpty().allSatisfy(s ->
                assertThat(ScheduleSlot.isValid(s.getStartTime(), s.getEndTime())).isTrue());
        assertThat(savedSessions).noneSatisfy(s -> {
            assertThat(s.getStartTime()).isBefore(ScheduleSlot.SLOT_5.endTime());
            assertThat(s.getEndTime()).isAfter(ScheduleSlot.SLOT_5.startTime());
        });
    }

    /** Kiểm thử P2-BE-25: tuân thủ quy tắc đa lớp/bộ môn và né slot đã bị lớp cùng bộ môn chiếm. */
    @Test
    void allowsAdditionalClassesInSameDisciplineWhileAvoidingSameDisciplineSlotOverlap() {
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        Discipline gym = discipline(1L, "Gym");
        GymClass existingGym = new GymClass();
        existingGym.setName("Existing Gym Course");
        existingGym.setStatus("active");
        existingGym.setDiscipline(gym);
        lenient().when(classes.findAll()).thenReturn(List.of(existingGym));

        // Lớp Gym có sẵn chiếm trọn Slot 1 mọi ngày -> seeder vẫn tạo các lớp Gym ở slot khác không trùng bộ môn
        List<ClassSession> occupiedGymSlot1 = new ArrayList<>();
        for (int d = -20; d <= 60; d++) {
            ClassSession s = new ClassSession();
            s.setGymClass(existingGym);
            s.setSessionDate(today.plusDays(d));
            s.setStartTime(ScheduleSlot.SLOT_1.startTime());
            s.setEndTime(ScheduleSlot.SLOT_1.endTime());
            s.setStatus("scheduled");
            occupiedGymSlot1.add(s);
        }
        lenient().when(sessions.findNotCancelledBetween(any(), any())).thenReturn(occupiedGymSlot1);

        seeder.run(null);

        List<GymClass> seededGym = savedClasses.stream()
                .filter(c -> "Gym".equals(c.getDiscipline().getName()))
                .toList();
        assertThat(seededGym).hasSize(2);
        assertThat(seededGym).allSatisfy(c ->
                assertThat(c.getStartTime()).isNotEqualTo(ScheduleSlot.SLOT_1.startTime()));
        assertThat(savedSessions).extracting(ClassSession::getStatus).contains("completed", "scheduled");
    }

    /** Kiểm thử: không tạo trùng những lớp đã tồn tại. */
    @Test
    void doesNotDuplicateClassesThatAlreadyExist() {
        List<GymClass> existing = DemoClassSeeder.CLASSES.stream().map(spec -> {
            GymClass c = new GymClass();
            c.setName(spec.name());
            return c;
        }).toList();
        lenient().when(classes.findAll()).thenReturn(existing);

        seeder.run(null);

        verify(classes, never()).save(any());
        verify(sessions, never()).save(any());
    }

    /** Kiểm thử: bỏ qua khi không có HLV khả dụng. */
    @Test
    void skipsWhenNoCoachIsAvailable() {
        lenient().when(coaches.findActiveWithUser()).thenReturn(List.of());

        seeder.run(null);

        verify(classes, never()).save(any());
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (coach). */
    private static Coach coach(Long id, String specialization) {
        Coach coach = new Coach();
        coach.setUserId(id);
        coach.setSpecialization(specialization);
        return coach;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (room). */
    private static Room room(Long id, String name, int capacity) {
        Room room = new Room();
        room.setId(id);
        room.setName(name);
        room.setCapacity(capacity);
        room.setStatus("available");
        return room;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (discipline). */
    private static Discipline discipline(Long id, String name) {
        Discipline discipline = new Discipline();
        ReflectionTestUtils.setField(discipline, "id", id);
        discipline.setName(name);
        return discipline;
    }
}
