package com.swp391.scms.scheduling;

import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RescheduleSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.UpdateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service ClassService (class service). */
@ExtendWith(MockitoExtension.class)
class ClassServiceTest {

    @Mock
    private GymClassRepository gymClasses;
    @Mock
    private ClassSessionRepository sessions;
    @Mock
    private ClassEnrollmentRepository enrollments;
    @Mock
    private DisciplineRepository disciplines;
    @Mock
    private CoachRepository coaches;
    @Mock
    private RoomRepository rooms;

    private final SchedulingMapper mapper = new SchedulingMapper();
    // Đồng hồ cố định: 10:00 giờ Việt Nam (03:00:00 UTC ngày 2026-10-16); ngày/giờ buổi học theo giờ địa phương của trung tâm.
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-16T03:00:00Z"), ZoneId.of("UTC"));

    private ClassService service;
    private GymClass gymClass;

    /** Chuẩn bị trước mỗi test: tạo ClassService với repository giả lập. */
    @BeforeEach
    void setUp() {
        service = new ClassService(gymClasses, sessions, enrollments, disciplines, coaches, rooms, mapper, clock);

        gymClass = new GymClass();
        gymClass.setName("Yoga Flow");
        gymClass.setCapacity(20);
        gymClass.setStatus("active");
    }

    /** Kiểm thử: từ chối tạo buổi có ngày trong quá khứ. */
    @Test
    @DisplayName("createSession rejects when sessionDate is in the past")
    void createSession_rejectsPastSessionDate() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 15),
                ScheduleSlot.SLOT_4.startTime(),
                ScheduleSlot.SLOT_4.endTime()
        );

        assertThatThrownBy(() -> service.createSession(1L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Session must start in the future");
    }

    /** Kiểm thử: từ chối giờ bắt đầu đã qua trong ngày hôm nay. */
    @Test
    @DisplayName("createSession rejects when session is today but start time has already passed")
    void createSession_rejectsPastStartTimeToday() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        // Đồng hồ đang ở 10:00:00, Slot 2 bắt đầu lúc 09:45:00 hôm nay
        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                ScheduleSlot.SLOT_2.startTime(),
                ScheduleSlot.SLOT_2.endTime()
        );

        assertThatThrownBy(() -> service.createSession(1L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Session must start in the future");
    }

    /** Kiểm thử: cho phép giờ bắt đầu trong tương lai của hôm nay. */
    @Test
    @DisplayName("createSession allows session today when start time is in the future")
    void createSession_allowsFutureStartTimeToday() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> {
            ClassSession s = i.getArgument(0);
            return s;
        });

        // Đồng hồ đang ở 10:00:00, Slot 3 bắt đầu lúc 11:30:00 hôm nay
        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                ScheduleSlot.SLOT_3.startTime(),
                ScheduleSlot.SLOT_3.endTime()
        );

        ClassSessionDto result = service.createSession(1L, request);
        assertThat(result).isNotNull();
        assertThat(result.startTime()).isEqualTo(ScheduleSlot.SLOT_3.startTime());
        assertThat(result.endTime()).isEqualTo(ScheduleSlot.SLOT_3.endTime());
    }

    /** Kiểm thử: cho phép các slot cố định kế tiếp nhau trong cùng ngày. */
    @Test
    @DisplayName("createSession allows two consecutive canonical slots on the same day")
    void createSession_allowsAdjacentSessions() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> i.getArgument(0));

        // Slot 3: 11:30 - 14:00
        CreateSessionRequest session1Req = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                ScheduleSlot.SLOT_3.startTime(),
                ScheduleSlot.SLOT_3.endTime()
        );
        ClassSessionDto session1 = service.createSession(1L, session1Req);
        assertThat(session1.startTime()).isEqualTo(ScheduleSlot.SLOT_3.startTime());
        assertThat(session1.endTime()).isEqualTo(ScheduleSlot.SLOT_3.endTime());

        // Slot 4: 14:15 - 16:45 (slot cố định kế tiếp ngay sau Slot 3, cách 15 phút nghỉ)
        CreateSessionRequest session2Req = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                ScheduleSlot.SLOT_4.startTime(),
                ScheduleSlot.SLOT_4.endTime()
        );
        ClassSessionDto session2 = service.createSession(1L, session2Req);
        assertThat(session2.startTime()).isEqualTo(ScheduleSlot.SLOT_4.startTime());
        assertThat(session2.endTime()).isEqualTo(ScheduleSlot.SLOT_4.endTime());

        assertThat(session2.startTime()).isAfter(session1.endTime());
    }

    /** Kiểm thử: từ chối khoảng giờ không hợp lệ. */
    @Test
    @DisplayName("createSession rejects when end time is before or equal to start time")
    void createSession_rejectsInvalidTimeRange() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                LocalTime.of(15, 0),
                LocalTime.of(14, 0)
        );

        assertThatThrownBy(() -> service.createSession(1L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End time must be after start time");
    }

    /** Kiểm thử: từ chối tạo buổi học có khung giờ ngoài 5 slot cố định. */
    @Test
    @DisplayName("createSession rejects time ranges outside the 5 canonical slots")
    void createSession_rejectsNonCanonicalSlot() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        for (LocalTime[] invalid : new LocalTime[][]{
                {LocalTime.of(8, 0), LocalTime.of(9, 0)},
                {LocalTime.of(7, 0), LocalTime.of(9, 0)},
                {LocalTime.of(19, 30), LocalTime.of(20, 30)}
        }) {
            CreateSessionRequest request = new CreateSessionRequest(
                    LocalDate.of(2026, 10, 18),
                    invalid[0],
                    invalid[1]
            );
            assertThatThrownBy(() -> service.createSession(1L, request))
                    .isInstanceOf(BadRequestException.class)
                    .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_INVALID_SLOT")
                    .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.invalid_slot");
        }
    }

    /** Kiểm thử: cập nhật lớp học thành công các trường được sửa. */
    @Test
    @DisplayName("SCRUM-131: updateClass updates class info when capacity is valid")
    void updateClass_updatesFieldsSuccessfully() {
        Discipline d = new Discipline();
        d.setName("Pilates");

        Coach coach = new Coach();
        coach.setUserId(10L);
        coach.setEmploymentStatus("active");

        Room room = new Room();
        room.setName("Studio B");
        room.setStatus("available");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(disciplines.findById(2L)).thenReturn(Optional.of(d));
        when(coaches.findById(10L)).thenReturn(Optional.of(coach));
        when(rooms.findById(3L)).thenReturn(Optional.of(room));
        when(enrollments.countByGymClassIdAndStatus(1L, "booked")).thenReturn(5L);
        when(gymClasses.saveAndFlush(any(GymClass.class))).thenAnswer(i -> i.getArgument(0));

        UpdateClassRequest req = new UpdateClassRequest(
                "Pilates Pro", 2L, 10L, 3L, 15, "intermediate", "Bring grip socks", "active");

        GymClassDto updated = service.updateClass(1L, req);
        assertThat(updated.name()).isEqualTo("Pilates Pro");
        assertThat(updated.capacity()).isEqualTo(15);
        assertThat(updated.level()).isEqualTo("intermediate");
    }

    /** Kiểm thử: từ chối giảm sức chứa xuống dưới số chỗ đã đặt. */
    @Test
    @DisplayName("SCRUM-131: updateClass rejects when new capacity is below booked student count")
    void updateClass_rejectsCapacityBelowBooked() {
        Discipline d = new Discipline();
        Coach coach = new Coach();
        coach.setUserId(10L);
        coach.setEmploymentStatus("active");
        Room room = new Room();
        room.setStatus("available");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(disciplines.findById(2L)).thenReturn(Optional.of(d));
        when(coaches.findById(10L)).thenReturn(Optional.of(coach));
        when(rooms.findById(3L)).thenReturn(Optional.of(room));
        when(enrollments.countByGymClassIdAndStatus(1L, "booked")).thenReturn(12L);

        UpdateClassRequest req = new UpdateClassRequest(
                "Pilates Pro", 2L, 10L, 3L, 8, "all", null, "active");

        assertThatThrownBy(() -> service.updateClass(1L, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Capacity cannot be less than current booked students");
    }

    /** Kiểm thử: dời lịch buổi học cập nhật ngày và giờ. */
    @Test
    @DisplayName("SCRUM-131: rescheduleSession updates date and time of scheduled session")
    void rescheduleSession_updatesDateAndTime() throws Exception {
        var idField = GymClass.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(gymClass, 1L);

        ClassSession session = new ClassSession();
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 17));
        session.setStartTime(ScheduleSlot.SLOT_1.startTime());
        session.setEndTime(ScheduleSlot.SLOT_1.endTime());
        session.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(100L)).thenReturn(Optional.of(session));
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> i.getArgument(0));

        RescheduleSessionRequest req = new RescheduleSessionRequest(
                LocalDate.of(2026, 10, 20),
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime()
        );

        ClassSessionDto dto = service.rescheduleSession(1L, 100L, req);
        assertThat(dto.sessionDate()).isEqualTo(LocalDate.of(2026, 10, 20));
        assertThat(dto.startTime()).isEqualTo(ScheduleSlot.SLOT_5.startTime());
        assertThat(dto.endTime()).isEqualTo(ScheduleSlot.SLOT_5.endTime());
    }

    /** Kiểm thử: từ chối dời lịch sang khung giờ ngoài 5 slot cố định. */
    @Test
    @DisplayName("rescheduleSession rejects non-canonical time slot")
    void rescheduleSession_rejectsNonCanonicalSlot() throws Exception {
        var idField = GymClass.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(gymClass, 1L);

        ClassSession session = new ClassSession();
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 17));
        session.setStartTime(ScheduleSlot.SLOT_1.startTime());
        session.setEndTime(ScheduleSlot.SLOT_1.endTime());
        session.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(100L)).thenReturn(Optional.of(session));

        RescheduleSessionRequest req = new RescheduleSessionRequest(
                LocalDate.of(2026, 10, 20),
                LocalTime.of(18, 0),
                LocalTime.of(19, 0)
        );

        assertThatThrownBy(() -> service.rescheduleSession(1L, 100L, req))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_INVALID_SLOT")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.invalid_slot");
    }

    /** Kiểm thử: từ chối dời lịch khi hội viên bị trùng lịch. */
    @Test
    @DisplayName("rescheduleSession rejects a time that overlaps another class a booked member already attends")
    void rescheduleSession_rejectsMemberOverlap() throws Exception {
        var idField = GymClass.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(gymClass, 1L);

        ClassSession session = new ClassSession();
        session.setGymClass(gymClass);
        session.setSessionDate(LocalDate.of(2026, 10, 17));
        session.setStartTime(ScheduleSlot.SLOT_1.startTime());
        session.setEndTime(ScheduleSlot.SLOT_1.endTime());
        session.setStatus("scheduled");

        GymClass boxing = new GymClass();
        boxing.setName("Boxing Cơ Bản");
        ClassSession other = new ClassSession();
        other.setGymClass(boxing);
        other.setStartTime(ScheduleSlot.SLOT_5.startTime());
        other.setEndTime(ScheduleSlot.SLOT_5.endTime());

        LocalDate date = LocalDate.of(2026, 10, 20);
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(100L)).thenReturn(Optional.of(session));
        when(sessions.findMemberOverlaps(1L, 100L, date, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime()))
                .thenReturn(java.util.List.of(other));

        assertThatThrownBy(() -> service.rescheduleSession(1L, 100L,
                new RescheduleSessionRequest(date, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime())))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Boxing Cơ Bản");
        verify(sessions, org.mockito.Mockito.never()).saveAndFlush(any(ClassSession.class));
    }

    /** Kiểm thử: xóa lớp sẽ xóa luôn các dữ liệu con. */
    @Test
    @DisplayName("SCRUM-131: deleteClass removes child enrollments, sessions and the class")
    void deleteClass_removesClassAndChildren() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        service.deleteClass(1L);

        verify(enrollments).deleteByGymClassId(1L);
        verify(sessions).deleteByGymClassId(1L);
        verify(gymClasses).delete(gymClass);
        verify(gymClasses).flush();
    }

    /** Kiểm thử: từ chối khi phòng bị trùng giờ với buổi khác. */
    @Test
    @DisplayName("SCRUM-132: createSession rejects when another class overlaps in the same room")
    void createSession_rejectsRoomConflictWhenOverlapping() throws Exception {
        Room sharedRoom = new Room();
        sharedRoom.setName("Studio A");
        var roomIdField = Room.class.getDeclaredField("id");
        roomIdField.setAccessible(true);
        roomIdField.set(sharedRoom, 5L);

        Coach coach1 = new Coach();
        coach1.setUserId(10L);
        Coach coach2 = new Coach();
        coach2.setUserId(20L);

        gymClass.setRoom(sharedRoom);
        gymClass.setCoach(coach1);

        GymClass otherClass = new GymClass();
        otherClass.setName("Pilates Core");
        otherClass.setRoom(sharedRoom);
        otherClass.setCoach(coach2);

        ClassSession existingSession = new ClassSession();
        existingSession.setGymClass(otherClass);
        existingSession.setSessionDate(LocalDate.of(2026, 10, 18));
        existingSession.setStartTime(ScheduleSlot.SLOT_1.startTime());
        existingSession.setEndTime(ScheduleSlot.SLOT_1.endTime());
        existingSession.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.searchSessions(LocalDate.of(2026, 10, 18), LocalDate.of(2026, 10, 18), null, null))
                .thenReturn(java.util.List.of(existingSession));

        CreateSessionRequest overlappingReq = new CreateSessionRequest(
                LocalDate.of(2026, 10, 18),
                ScheduleSlot.SLOT_1.startTime(),
                ScheduleSlot.SLOT_1.endTime()
        );

        assertThatThrownBy(() -> service.createSession(1L, overlappingReq))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Schedule conflict: Room Studio A")
                .extracting("errorCode")
                .isEqualTo("SCHEDULING_ROOM_CONFLICT");
    }

    /** Kiểm thử: từ chối khi HLV bị trùng giờ với buổi khác. */
    @Test
    @DisplayName("SCRUM-132: createSession rejects when the same coach is assigned to two overlapping classes")
    void createSession_rejectsCoachConflictWhenOverlapping() throws Exception {
        Room room1 = new Room();
        room1.setName("Studio A");
        var roomIdField = Room.class.getDeclaredField("id");
        roomIdField.setAccessible(true);
        roomIdField.set(room1, 5L);

        Room room2 = new Room();
        room2.setName("Studio B");
        roomIdField.set(room2, 6L);

        Coach sharedCoach = new Coach();
        sharedCoach.setUserId(10L);

        gymClass.setRoom(room1);
        gymClass.setCoach(sharedCoach);

        GymClass otherClass = new GymClass();
        otherClass.setName("Boxing Burn");
        otherClass.setRoom(room2);
        otherClass.setCoach(sharedCoach);

        ClassSession existingSession = new ClassSession();
        existingSession.setGymClass(otherClass);
        existingSession.setSessionDate(LocalDate.of(2026, 10, 18));
        existingSession.setStartTime(ScheduleSlot.SLOT_5.startTime());
        existingSession.setEndTime(ScheduleSlot.SLOT_5.endTime());
        existingSession.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.searchSessions(LocalDate.of(2026, 10, 18), LocalDate.of(2026, 10, 18), null, null))
                .thenReturn(java.util.List.of(existingSession));

        CreateSessionRequest overlappingReq = new CreateSessionRequest(
                LocalDate.of(2026, 10, 18),
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime()
        );

        assertThatThrownBy(() -> service.createSession(1L, overlappingReq))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Schedule conflict: Coach")
                .extracting("errorCode")
                .isEqualTo("SCHEDULING_COACH_CONFLICT");
    }

    /**
     * Kiểm thử: liệt kê HLV đang hoạt động bằng truy vấn database và các entity vai trò dùng quan hệ one-to-one
     * lazy.
     */
    @Test
    void listActiveCoaches_UsesDatabaseQueryAndRoleEntitiesUseLazyOneToOne() throws Exception {
        for (Class<?> entityClass : new Class<?>[]{
                com.swp391.scms.users.entity.Member.class,
                com.swp391.scms.users.entity.Coach.class,
                com.swp391.scms.users.entity.Receptionist.class,
                com.swp391.scms.users.entity.CenterManager.class
        }) {
            var oneToOne = entityClass.getDeclaredField("user").getAnnotation(jakarta.persistence.OneToOne.class);
            assertThat(oneToOne.fetch()).as(entityClass.getSimpleName() + ".user fetch type")
                    .isEqualTo(jakarta.persistence.FetchType.LAZY);
        }

        var user = new com.swp391.scms.users.entity.User();
        user.setFullName("Coach Active");
        user.setEmail("coach@sol.vn");
        user.setPhone("0900000001");
        user.setStatus("active");
        var coach = new Coach();
        coach.setUserId(42L);
        coach.setEmploymentStatus("active");
        coach.setUser(user);

        when(coaches.findActiveWithUser()).thenReturn(java.util.List.of(coach));

        var options = service.listActiveCoaches();
        assertThat(options).hasSize(1);
        assertThat(options.get(0).fullName()).isEqualTo("Coach Active");
        verify(coaches).findActiveWithUser();
        verify(coaches, org.mockito.Mockito.never()).findAll();
    }

    /** Kiểm thử: danh sách học viên của buổi gộp ghi danh toàn lớp với đặt chỗ riêng từng buổi. */
    @Test
    void sessionStudentsMergeClassWideEnrollmentsWithPerSessionBookings() {
        com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.SessionBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "sessionBookings", sessionBookings);
        com.swp391.scms.scheduling.entity.GymClass cls = new com.swp391.scms.scheduling.entity.GymClass();
        cls.setId(5L);
        ClassSession session = new ClassSession();
        session.setId(7L);
        session.setGymClass(cls);
        when(sessions.findById(7L)).thenReturn(java.util.Optional.of(session));
        com.swp391.scms.users.entity.Member classWide = new com.swp391.scms.users.entity.Member();
        classWide.setUserId(20L);
        com.swp391.scms.scheduling.entity.ClassEnrollment enrollment = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        enrollment.setMember(classWide);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassId(5L)).thenReturn(java.util.List.of(enrollment));
        com.swp391.scms.users.entity.Member sessionOnly = new com.swp391.scms.users.entity.Member();
        sessionOnly.setUserId(21L);
        com.swp391.scms.scheduling.entity.SessionBooking booking = new com.swp391.scms.scheduling.entity.SessionBooking();
        booking.setMember(sessionOnly);
        booking.setStatus("booked");
        com.swp391.scms.scheduling.entity.SessionBooking duplicate = new com.swp391.scms.scheduling.entity.SessionBooking();
        duplicate.setMember(classWide);
        duplicate.setStatus("booked");
        when(sessionBookings.findBySessionIdAndStatus(7L, "booked")).thenReturn(java.util.List.of(booking, duplicate));

        var students = service.getSessionStudents(7L);

        org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of(20L, 21L),
                students.stream().map(s -> s.memberId()).toList());
    }

    /** Kiểm thử: xóa lớp có dữ liệu lịch sử thì chỉ hủy kích hoạt mềm và thông báo, không gửi trùng. */
    @Test
    @DisplayName("deleteClass soft-deactivates class, cancels scheduled sessions and deduplicates notifications when historical data exists")
    void deleteClass_softDeactivatesAndNotifiesWithoutDuplicatesWhenHistoricalDataExists() {
        var sessionBookings = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.SessionBookingRepository.class);
        var notificationService = org.mockito.Mockito.mock(com.swp391.scms.notifications.NotificationService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "sessionBookings", sessionBookings);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "notificationService", notificationService);

        gymClass.setId(1L);
        gymClass.setName("Yoga Flow");
        gymClass.setStatus("active");
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));

        ClassSession pastSession = new ClassSession();
        pastSession.setId(101L);
        pastSession.setGymClass(gymClass);
        pastSession.setSessionDate(LocalDate.of(2026, 10, 10));
        pastSession.setStartTime(LocalTime.of(8, 0));
        pastSession.setEndTime(LocalTime.of(9, 0));
        pastSession.setStatus("completed");

        ClassSession upcomingSession = new ClassSession();
        upcomingSession.setId(102L);
        upcomingSession.setGymClass(gymClass);
        upcomingSession.setSessionDate(LocalDate.of(2026, 10, 20));
        upcomingSession.setStartTime(LocalTime.of(8, 0));
        upcomingSession.setEndTime(LocalTime.of(9, 0));
        upcomingSession.setStatus("scheduled");

        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(1L))
                .thenReturn(java.util.List.of(pastSession, upcomingSession));

        com.swp391.scms.users.entity.Member member20 = new com.swp391.scms.users.entity.Member();
        member20.setUserId(20L);
        com.swp391.scms.scheduling.entity.ClassEnrollment classWideEnrollment = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        classWideEnrollment.setGymClass(gymClass);
        classWideEnrollment.setMember(member20);
        classWideEnrollment.setStatus("booked");

        com.swp391.scms.users.entity.Member member21 = new com.swp391.scms.users.entity.Member();
        member21.setUserId(21L);
        com.swp391.scms.scheduling.entity.ClassEnrollment cancelledEnrollment = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        cancelledEnrollment.setGymClass(gymClass);
        cancelledEnrollment.setMember(member21);
        cancelledEnrollment.setStatus("cancelled");

        when(enrollments.findByGymClassId(1L))
                .thenReturn(java.util.List.of(classWideEnrollment, cancelledEnrollment));

        com.swp391.scms.users.entity.Member member22 = new com.swp391.scms.users.entity.Member();
        member22.setUserId(22L);
        com.swp391.scms.scheduling.entity.SessionBooking booking20 = new com.swp391.scms.scheduling.entity.SessionBooking();
        booking20.setSession(upcomingSession);
        booking20.setMember(member20);
        booking20.setStatus("booked");

        com.swp391.scms.scheduling.entity.SessionBooking booking22 = new com.swp391.scms.scheduling.entity.SessionBooking();
        booking22.setSession(upcomingSession);
        booking22.setMember(member22);
        booking22.setStatus("booked");

        when(sessionBookings.findBySessionIdAndStatus(102L, "booked"))
                .thenReturn(java.util.List.of(booking20, booking22));

        service.deleteClass(1L);

        assertThat(gymClass.getStatus()).isEqualTo("inactive");
        assertThat(pastSession.getStatus()).isEqualTo("completed");
        assertThat(upcomingSession.getStatus()).isEqualTo("cancelled");
        assertThat(upcomingSession.getCancelReason()).isEqualTo("Lớp học ngừng hoạt động");
        assertThat(booking20.getStatus()).isEqualTo("cancelled");
        assertThat(booking22.getStatus()).isEqualTo("cancelled");
        assertThat(classWideEnrollment.getStatus()).isEqualTo("cancelled");

        verify(notificationService, org.mockito.Mockito.times(1)).send(
                org.mockito.ArgumentMatchers.eq(20L),
                any(), any(), org.mockito.ArgumentMatchers.eq("schedule_change"),
                org.mockito.ArgumentMatchers.eq("class_session"),
                org.mockito.ArgumentMatchers.eq(102L));
        verify(notificationService, org.mockito.Mockito.times(1)).send(
                org.mockito.ArgumentMatchers.eq(22L),
                any(), any(), org.mockito.ArgumentMatchers.eq("schedule_change"),
                org.mockito.ArgumentMatchers.eq("class_session"),
                org.mockito.ArgumentMatchers.eq(102L));
        verify(notificationService, org.mockito.Mockito.never()).send(
                org.mockito.ArgumentMatchers.eq(21L),
                any(), any(), any(), any(), any());
        verify(gymClasses, org.mockito.Mockito.never()).delete(any());
    }

    /** Kiểm thử: xóa lớp đã có thanh toán hoặc đánh giá thì chỉ hủy kích hoạt mềm. */
    @Test
    @DisplayName("deleteClass soft-deactivates when payment or coach review exists for the class")
    void deleteClass_softDeactivatesWhenPaymentsOrReviewsExist() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "payments", payments);

        gymClass.setId(1L);
        gymClass.setStatus("active");
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByGymClassId(1L)).thenReturn(java.util.List.of());
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(1L)).thenReturn(java.util.List.of());
        when(payments.existsByClassEnrollmentGymClassId(1L)).thenReturn(true);

        service.deleteClass(1L);

        assertThat(gymClass.getStatus()).isEqualTo("inactive");
        verify(gymClasses).save(gymClass);
        verify(gymClasses, org.mockito.Mockito.never()).delete(any());
    }

    /** Kiểm thử: không cho xếp buổi lớp mới nếu HLV đã có buổi PT 1:1 confirmed trùng giờ. */
    @Test
    @DisplayName("createSession rejects when coach already has a confirmed 1:1 PT booking in the slot")
    void createSession_rejectsWhenCoachHasConfirmedPtBooking() {
        var ptRepo = org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "coachBookingRepository", ptRepo);

        Coach coach = new Coach();
        coach.setUserId(10L);
        var coachUser = new com.swp391.scms.users.entity.User();
        coachUser.setFullName("Coach An");
        coach.setUser(coachUser);
        gymClass.setId(1L);
        gymClass.setCoach(coach);
        gymClass.setStatus("active");
        LocalDate futureDate = LocalDate.now(clock).plusDays(2);
        var pt = new com.swp391.scms.coaching.entity.CoachBooking();
        pt.setCoach(coach);
        pt.setBookingDate(futureDate);
        pt.setStartTime(ScheduleSlot.SLOT_5.startTime());
        pt.setEndTime(ScheduleSlot.SLOT_5.endTime());
        pt.setStatus("confirmed");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(ptRepo.findActiveByCoachAndDate(coach.getUserId(), futureDate)).thenReturn(java.util.List.of(pt));

        assertThatThrownBy(() -> service.createSession(1L, new CreateSessionRequest(
                futureDate, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime())))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_COACH_PT_CONFLICT")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.coach_pt_conflict");
        verify(sessions, org.mockito.Mockito.never()).saveAndFlush(any());
    }

    /** Kiểm thử: dời buổi học kiểm tra trùng PT 1:1 của HLV và thông báo học viên lẫn HLV khi thành công. */
    @Test
    @DisplayName("rescheduleSession rejects coach PT conflict and notifies booked members and coach on success")
    void rescheduleSession_checksCoachPtConflictAndNotifiesMembersAndCoach() {
        var ptRepo = org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
        var notificationService = org.mockito.Mockito.mock(com.swp391.scms.notifications.NotificationService.class);
        var sessionBookings = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.SessionBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "coachBookingRepository", ptRepo);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "notificationService", notificationService);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "sessionBookings", sessionBookings);

        Coach coach = new Coach();
        coach.setUserId(10L);
        var coachUser = new com.swp391.scms.users.entity.User();
        coachUser.setFullName("Coach An");
        coach.setUser(coachUser);
        gymClass.setId(1L);
        gymClass.setName("Yoga Flow");
        gymClass.setCoach(coach);
        gymClass.setStatus("active");

        LocalDate oldDate = LocalDate.now(clock).plusDays(2);
        LocalDate newDate = LocalDate.now(clock).plusDays(3);
        ClassSession existing = new ClassSession();
        existing.setId(55L);
        existing.setGymClass(gymClass);
        existing.setSessionDate(oldDate);
        existing.setStartTime(ScheduleSlot.SLOT_2.startTime());
        existing.setEndTime(ScheduleSlot.SLOT_2.endTime());
        existing.setStatus("scheduled");

        var busyPt = new com.swp391.scms.coaching.entity.CoachBooking();
        busyPt.setCoach(coach);
        busyPt.setBookingDate(newDate);
        busyPt.setStartTime(ScheduleSlot.SLOT_4.startTime());
        busyPt.setEndTime(ScheduleSlot.SLOT_4.endTime());
        busyPt.setStatus("confirmed");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(55L)).thenReturn(Optional.of(existing));
        when(ptRepo.findActiveByCoachAndDate(coach.getUserId(), newDate)).thenReturn(java.util.List.of(busyPt));

        // 1. Dời đè lên buổi PT 1:1 → bị từ chối
        assertThatThrownBy(() -> service.rescheduleSession(1L, 55L,
                new RescheduleSessionRequest(newDate, ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime())))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_COACH_PT_CONFLICT");

        // 2. Dời sang khung giờ trống → thành công và gửi thông báo không trùng cho học viên + HLV
        var member20 = new com.swp391.scms.users.entity.Member();
        member20.setUserId(20L);
        var enrollment20 = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        enrollment20.setMember(member20);
        enrollment20.setStatus("booked");
        var duplicateBooking20 = new com.swp391.scms.scheduling.entity.SessionBooking();
        duplicateBooking20.setMember(member20);
        duplicateBooking20.setStatus("booked");

        when(sessions.searchSessions(newDate, newDate, null, null)).thenReturn(java.util.List.of());
        when(sessions.findMemberOverlaps(1L, 55L, newDate, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime()))
                .thenReturn(java.util.List.of());
        when(sessions.saveAndFlush(existing)).thenReturn(existing);
        when(enrollments.findByGymClassId(1L)).thenReturn(java.util.List.of(enrollment20));
        when(sessionBookings.findBySessionIdAndStatus(55L, "booked")).thenReturn(java.util.List.of(duplicateBooking20));

        service.rescheduleSession(1L, 55L,
                new RescheduleSessionRequest(newDate, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime()));

        verify(notificationService, org.mockito.Mockito.times(1)).send(
                org.mockito.ArgumentMatchers.eq(20L),
                any(), any(), org.mockito.ArgumentMatchers.eq("schedule_change"),
                org.mockito.ArgumentMatchers.eq("class_session"),
                org.mockito.ArgumentMatchers.eq(55L));
        verify(notificationService, org.mockito.Mockito.times(1)).send(
                org.mockito.ArgumentMatchers.eq(coach.getUserId()),
                any(), any(), org.mockito.ArgumentMatchers.eq("schedule_change"),
                org.mockito.ArgumentMatchers.eq("class_session"),
                org.mockito.ArgumentMatchers.eq(55L));
    }

    /** Kiểm thử: cho phép nhiều lớp active trong cùng một bộ môn nếu không trùng slot/ngày học. */
    @Test
    @DisplayName("createRecurringClass allows multiple active classes in the same discipline on non-overlapping slots or weekdays")
    void allowsMultipleActiveClassesInSameDisciplineOnNonOverlappingSchedules() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Coach coach1 = new Coach();
        coach1.setUserId(2L);
        coach1.setEmploymentStatus("active");
        Coach coach2 = new Coach();
        coach2.setUserId(20L);
        coach2.setEmploymentStatus("active");
        Room studio1 = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(studio1, "id", 3L);
        studio1.setStatus("available");
        studio1.setName("Zen Garden Studio");
        studio1.setCapacity(20);
        Room studio2 = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(studio2, "id", 4L);
        studio2.setStatus("available");
        studio2.setName("Studio 2");
        studio2.setCapacity(20);

        GymClass existingYoga = new GymClass();
        existingYoga.setId(50L);
        existingYoga.setName("Hatha Yoga Sáng");
        existingYoga.setDiscipline(yoga);
        existingYoga.setCoach(coach1);
        existingYoga.setRoom(studio1);
        existingYoga.setStatus("active");

        LocalDate monday = LocalDate.of(2026, 10, 19); // Thứ 2
        ClassSession morningSession = new ClassSession();
        morningSession.setId(501L);
        morningSession.setGymClass(existingYoga);
        morningSession.setSessionDate(monday);
        morningSession.setStartTime(ScheduleSlot.SLOT_1.startTime());
        morningSession.setEndTime(ScheduleSlot.SLOT_1.endTime());
        morningSession.setStatus("scheduled");

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(coaches.findById(20L)).thenReturn(Optional.of(coach2));
        when(rooms.findById(4L)).thenReturn(Optional.of(studio2));
        when(sessions.searchSessions(monday, monday, null, null)).thenReturn(java.util.List.of(morningSession));
        when(gymClasses.save(any(GymClass.class))).thenAnswer(inv -> {
            GymClass c = inv.getArgument(0);
            c.setId(51L);
            return c;
        });
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(inv -> inv.getArgument(0));

        // Lớp Yoga thứ 2 cùng ngày Thứ 2 nhưng khác slot (Slot 5 thay vì Slot 1) → hợp lệ
        var eveningReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Buổi Tối",
                1L,
                20L,
                4L,
                15,
                "all",
                "desc",
                java.math.BigDecimal.ZERO,
                monday,
                monday,
                java.util.List.of("MONDAY"),
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime()
        );

        GymClassDto created = service.createRecurringClass(eveningReq);
        assertThat(created.id()).isEqualTo(51L);
        assertThat(created.name()).isEqualTo("Yoga Buổi Tối");

        // Lớp Yoga thứ 3 cùng Slot 1 nhưng khác thứ (Thứ 3 = 2026-10-20) → hợp lệ
        LocalDate tuesday = LocalDate.of(2026, 10, 20);
        when(sessions.searchSessions(tuesday, tuesday, null, null)).thenReturn(java.util.List.of());
        var tuesdayReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Sáng Thứ 3",
                1L,
                20L,
                4L,
                15,
                "all",
                "desc",
                java.math.BigDecimal.ZERO,
                tuesday,
                tuesday,
                java.util.List.of("TUESDAY"),
                ScheduleSlot.SLOT_1.startTime(),
                ScheduleSlot.SLOT_1.endTime()
        );
        GymClassDto createdTuesday = service.createRecurringClass(tuesdayReq);
        assertThat(createdTuesday.name()).isEqualTo("Yoga Sáng Thứ 3");
    }

    /** Kiểm thử: từ chối trùng khung giờ cùng bộ môn trên createRecurringClass, createClass, updateClass và rescheduleSession. */
    @Test
    @DisplayName("rejects same-discipline overlapping slot on createRecurringClass, createClass, updateClass and rescheduleSession")
    void rejectsSameDisciplineOverlapAcrossSchedulingOperations() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Discipline boxing = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(boxing, "id", 2L);
        boxing.setName("Boxing");

        Coach coach1 = new Coach();
        coach1.setUserId(10L);
        coach1.setEmploymentStatus("active");
        Coach coach2 = new Coach();
        coach2.setUserId(20L);
        coach2.setEmploymentStatus("active");

        Room room1 = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(room1, "id", 30L);
        room1.setName("Zen Garden Studio");
        room1.setStatus("available");
        room1.setCapacity(20);
        Room room2 = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(room2, "id", 40L);
        room2.setName("Studio 2");
        room2.setStatus("available");
        room2.setCapacity(20);

        GymClass existingYoga = new GymClass();
        existingYoga.setId(50L);
        existingYoga.setName("Hatha Yoga Nền Tảng");
        existingYoga.setDiscipline(yoga);
        existingYoga.setCoach(coach1);
        existingYoga.setRoom(room1);
        existingYoga.setStatus("active");

        LocalDate monday = LocalDate.of(2026, 10, 19);
        ClassSession existingSession = new ClassSession();
        existingSession.setId(501L);
        existingSession.setGymClass(existingYoga);
        existingSession.setSessionDate(monday);
        existingSession.setStartTime(ScheduleSlot.SLOT_2.startTime());
        existingSession.setEndTime(ScheduleSlot.SLOT_2.endTime());
        existingSession.setStatus("scheduled");

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(coaches.findById(20L)).thenReturn(Optional.of(coach2));
        when(rooms.findById(40L)).thenReturn(Optional.of(room2));
        when(sessions.searchSessions(monday, monday, null, null)).thenReturn(java.util.List.of(existingSession));

        // 1. createRecurringClass: khác phòng & khác HLV nhưng cùng bộ môn Yoga + cùng Slot 2 ngày Thứ 2 → 409 SCHEDULING_DISCIPLINE_CONFLICT
        var recurringReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Flow Nâng Cao", 1L, 20L, 40L, 15, "all", "desc",
                java.math.BigDecimal.ZERO, monday, monday, java.util.List.of("MONDAY"),
                ScheduleSlot.SLOT_2.startTime(), ScheduleSlot.SLOT_2.endTime());
        assertThatThrownBy(() -> service.createRecurringClass(recurringReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CONFLICT")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.discipline_conflict");

        // 2. createClass: cùng bộ môn Yoga + cùng Slot 2 ngày Thứ 2 → 409 SCHEDULING_DISCIPLINE_CONFLICT
        var singleReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest(
                "Yoga Lẻ", 1L, 20L, 40L, 15, "all", "desc",
                monday, ScheduleSlot.SLOT_2.startTime(), ScheduleSlot.SLOT_2.endTime());
        assertThatThrownBy(() -> service.createClass(singleReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CONFLICT");

        // 3. updateClass: đổi bộ môn từ Boxing sang Yoga khi có buổi trùng giờ → 409 SCHEDULING_DISCIPLINE_CONFLICT
        GymClass boxingClass = new GymClass();
        boxingClass.setId(60L);
        boxingClass.setName("Boxing Sáng");
        boxingClass.setDiscipline(boxing);
        boxingClass.setCoach(coach2);
        boxingClass.setRoom(room2);
        boxingClass.setStatus("active");

        ClassSession boxingSession = new ClassSession();
        boxingSession.setId(601L);
        boxingSession.setGymClass(boxingClass);
        boxingSession.setSessionDate(monday);
        boxingSession.setStartTime(ScheduleSlot.SLOT_2.startTime());
        boxingSession.setEndTime(ScheduleSlot.SLOT_2.endTime());
        boxingSession.setStatus("scheduled");

        when(gymClasses.findById(60L)).thenReturn(Optional.of(boxingClass));
        when(enrollments.countByGymClassIdAndStatus(60L, "booked")).thenReturn(0L);
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(60L)).thenReturn(java.util.List.of(boxingSession));

        var changeDisciplineReq = new UpdateClassRequest(
                "Đổi sang Yoga", 1L, 20L, 40L, 15, "all", "desc", "active");
        assertThatThrownBy(() -> service.updateClass(60L, changeDisciplineReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CONFLICT");

        // 4. updateClass: kích hoạt lại lớp archived sang active khi trùng giờ với lớp active cùng bộ môn → 409 SCHEDULING_DISCIPLINE_CONFLICT
        GymClass archivedYoga = new GymClass();
        archivedYoga.setId(61L);
        archivedYoga.setName("Yoga Cũ");
        archivedYoga.setDiscipline(yoga);
        archivedYoga.setCoach(coach2);
        archivedYoga.setRoom(room2);
        archivedYoga.setStatus("archived");

        ClassSession archivedSession = new ClassSession();
        archivedSession.setId(611L);
        archivedSession.setGymClass(archivedYoga);
        archivedSession.setSessionDate(monday);
        archivedSession.setStartTime(ScheduleSlot.SLOT_2.startTime());
        archivedSession.setEndTime(ScheduleSlot.SLOT_2.endTime());
        archivedSession.setStatus("scheduled");

        when(gymClasses.findById(61L)).thenReturn(Optional.of(archivedYoga));
        when(enrollments.countByGymClassIdAndStatus(61L, "booked")).thenReturn(0L);
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(61L)).thenReturn(java.util.List.of(archivedSession));

        var reactivateReq = new UpdateClassRequest(
                "Yoga Cũ", 1L, 20L, 40L, 15, "all", "desc", "active");
        assertThatThrownBy(() -> service.updateClass(61L, reactivateReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CONFLICT");

        // 5. rescheduleSession: dời buổi của lớp Yoga khác sang đúng Slot 2 ngày Thứ 2 → 409 SCHEDULING_DISCIPLINE_CONFLICT
        GymClass secondYoga = new GymClass();
        secondYoga.setId(62L);
        secondYoga.setName("Yoga Chiều");
        secondYoga.setDiscipline(yoga);
        secondYoga.setCoach(coach2);
        secondYoga.setRoom(room2);
        secondYoga.setStatus("active");

        ClassSession secondSession = new ClassSession();
        secondSession.setId(621L);
        secondSession.setGymClass(secondYoga);
        secondSession.setSessionDate(monday);
        secondSession.setStartTime(ScheduleSlot.SLOT_5.startTime());
        secondSession.setEndTime(ScheduleSlot.SLOT_5.endTime());
        secondSession.setStatus("scheduled");

        when(gymClasses.findById(62L)).thenReturn(Optional.of(secondYoga));
        when(sessions.findById(621L)).thenReturn(Optional.of(secondSession));

        assertThatThrownBy(() -> service.rescheduleSession(62L, 621L,
                new RescheduleSessionRequest(monday, ScheduleSlot.SLOT_2.startTime(), ScheduleSlot.SLOT_2.endTime())))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CONFLICT");
    }

    /** Kiểm thử: từ chối sĩ số vượt sức chứa phòng trên createClass, createRecurringClass và updateClass. */
    @Test
    @DisplayName("rejects requested capacity exceeding room capacity with 400 SCHEDULING_CAPACITY_EXCEEDS_ROOM")
    void rejectsCapacityExceedingRoomCapacity() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Coach activeCoach = new Coach();
        activeCoach.setUserId(2L);
        activeCoach.setEmploymentStatus("active");
        Room smallRoom = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(smallRoom, "id", 3L);
        smallRoom.setName("Zen Garden Studio");
        smallRoom.setStatus("available");
        smallRoom.setCapacity(16);

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(coaches.findById(2L)).thenReturn(Optional.of(activeCoach));
        when(rooms.findById(3L)).thenReturn(Optional.of(smallRoom));

        var recurringReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Đông", 1L, 2L, 3L, 20, "all", "desc",
                java.math.BigDecimal.ZERO, LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 26),
                java.util.List.of("MONDAY"), ScheduleSlot.SLOT_1.startTime(), ScheduleSlot.SLOT_1.endTime());
        assertThatThrownBy(() -> service.createRecurringClass(recurringReq))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_CAPACITY_EXCEEDS_ROOM")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.capacity_exceeds_room");

        var singleReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest(
                "Yoga Đông", 1L, 2L, 3L, 17, "all", "desc");
        assertThatThrownBy(() -> service.createClass(singleReq))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_CAPACITY_EXCEEDS_ROOM");

        gymClass.setId(1L);
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        var updateReq = new UpdateClassRequest("Yoga Đông", 1L, 2L, 3L, 18, "all", "desc", "active");
        assertThatThrownBy(() -> service.updateClass(1L, updateReq))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_CAPACITY_EXCEEDS_ROOM");
    }

    /** Kiểm thử: từ chối học phí âm khi tạo khóa định kỳ. */
    @Test
    @DisplayName("createRecurringClass rejects negative course price with 400 SCHEDULING_INVALID_PRICE")
    void createRecurringClass_rejectsNegativePrice() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Coach activeCoach = new Coach();
        activeCoach.setUserId(2L);
        activeCoach.setEmploymentStatus("active");
        Room studio = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(studio, "id", 3L);
        studio.setStatus("available");
        studio.setCapacity(20);

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(coaches.findById(2L)).thenReturn(Optional.of(activeCoach));
        when(rooms.findById(3L)).thenReturn(Optional.of(studio));

        var negativePriceReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Giá Âm", 1L, 2L, 3L, 15, "all", "desc",
                new java.math.BigDecimal("-1000"),
                LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 26),
                java.util.List.of("MONDAY"), ScheduleSlot.SLOT_1.startTime(), ScheduleSlot.SLOT_1.endTime());

        assertThatThrownBy(() -> service.createRecurringClass(negativePriceReq))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_INVALID_PRICE")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.invalid_price");
    }

    /** Kiểm thử: kiểm tra trước lịch trống trên 5 slot, phát hiện xung đột bộ môn, phòng, lớp HLV, PT 1:1 và nghỉ phép HLV. */
    @Test
    @DisplayName("checkRecurringAvailability previews 5 slots, discipline conflict, room conflicts, coach class/PT/leave conflicts")
    void checkRecurringAvailability_evaluatesFiveSlotsDisciplineRoomAndCoachConflicts() {
        var leaveRepo = org.mockito.Mockito.mock(com.swp391.scms.operations.repository.StaffInternalRequestRepository.class);
        var ptRepo = org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "staffInternalRequestRepository", leaveRepo);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "coachBookingRepository", ptRepo);

        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Discipline boxing = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(boxing, "id", 2L);
        boxing.setName("Boxing");

        Room studioA = new Room();
        studioA.setId(10L);
        studioA.setName("Zen Garden Studio");
        studioA.setLocation("Tầng 2");
        studioA.setCapacity(16);
        studioA.setTier("STANDARD");
        studioA.setStatus("available");

        Room studioB = new Room();
        studioB.setId(11L);
        studioB.setName("Phòng Gym VIP");
        studioB.setLocation("Tầng 3");
        studioB.setCapacity(24);
        studioB.setTier("PLATINUM");
        studioB.setStatus("available");

        Room closedRoom = new Room();
        closedRoom.setId(12L);
        closedRoom.setName("Phòng Bảo Trì");
        closedRoom.setStatus("maintenance");

        var userClassBusy = new com.swp391.scms.users.entity.User();
        userClassBusy.setFullName("HLV Lớp Nhóm");
        userClassBusy.setEmail("classbusy@sol.vn");
        Coach coachClassBusy = new Coach();
        coachClassBusy.setUserId(101L);
        coachClassBusy.setEmploymentStatus("active");
        coachClassBusy.setUser(userClassBusy);

        var userPtBusy = new com.swp391.scms.users.entity.User();
        userPtBusy.setFullName("HLV Bận PT");
        userPtBusy.setEmail("ptbusy@sol.vn");
        Coach coachPtBusy = new Coach();
        coachPtBusy.setUserId(102L);
        coachPtBusy.setEmploymentStatus("active");
        coachPtBusy.setUser(userPtBusy);

        var userOnLeave = new com.swp391.scms.users.entity.User();
        userOnLeave.setFullName("HLV Nghỉ Phép");
        userOnLeave.setEmail("leave@sol.vn");
        Coach coachOnLeave = new Coach();
        coachOnLeave.setUserId(103L);
        coachOnLeave.setEmploymentStatus("active");
        coachOnLeave.setUser(userOnLeave);

        var userFree = new com.swp391.scms.users.entity.User();
        userFree.setFullName("HLV Rảnh");
        userFree.setEmail("free@sol.vn");
        Coach coachFree = new Coach();
        coachFree.setUserId(104L);
        coachFree.setEmploymentStatus("active");
        coachFree.setUser(userFree);

        // Khoảng ngày: 2026-10-19 (Thứ 2) -> 2026-10-25 (Chủ nhật), lặp MONDAY & WEDNESDAY => 2 buổi (19/10 & 21/10)
        LocalDate mon = LocalDate.of(2026, 10, 19);
        LocalDate wed = LocalDate.of(2026, 10, 21);

        // Slot 1 ngày Thứ 2: có lớp Yoga đang active dùng studioA & coachClassBusy -> gây xung đột bộ môn Yoga ở Slot 1
        GymClass yogaMorning = new GymClass();
        yogaMorning.setId(500L);
        yogaMorning.setName("Hatha Yoga Nền Tảng");
        yogaMorning.setDiscipline(yoga);
        yogaMorning.setRoom(studioA);
        yogaMorning.setCoach(coachClassBusy);
        yogaMorning.setStatus("active");
        ClassSession yogaMorningSession = new ClassSession();
        yogaMorningSession.setId(5001L);
        yogaMorningSession.setGymClass(yogaMorning);
        yogaMorningSession.setSessionDate(mon);
        yogaMorningSession.setStartTime(ScheduleSlot.SLOT_1.startTime());
        yogaMorningSession.setEndTime(ScheduleSlot.SLOT_1.endTime());
        yogaMorningSession.setStatus("scheduled");

        // Slot 2 ngày Thứ 2: lớp Boxing dùng studioA & coachClassBusy (KHÔNG trùng bộ môn Yoga, chỉ chiếm 1 phòng & 1 HLV)
        GymClass boxingClass = new GymClass();
        boxingClass.setId(501L);
        boxingClass.setName("Boxing Cơ Bản");
        boxingClass.setDiscipline(boxing);
        boxingClass.setRoom(studioA);
        boxingClass.setCoach(coachClassBusy);
        boxingClass.setStatus("active");
        ClassSession boxingSlot2Session = new ClassSession();
        boxingSlot2Session.setId(5002L);
        boxingSlot2Session.setGymClass(boxingClass);
        boxingSlot2Session.setSessionDate(mon);
        boxingSlot2Session.setStartTime(ScheduleSlot.SLOT_2.startTime());
        boxingSlot2Session.setEndTime(ScheduleSlot.SLOT_2.endTime());
        boxingSlot2Session.setStatus("scheduled");

        // Slot 2 ngày Thứ 4: coachPtBusy có buổi PT 1:1 confirmed
        var ptSlot2 = new com.swp391.scms.coaching.entity.CoachBooking();
        ptSlot2.setCoach(coachPtBusy);
        ptSlot2.setBookingDate(wed);
        ptSlot2.setStartTime(ScheduleSlot.SLOT_2.startTime());
        ptSlot2.setEndTime(ScheduleSlot.SLOT_2.endTime());
        ptSlot2.setStatus("confirmed");

        // coachOnLeave có đơn nghỉ phép APPROVED ngày Thứ 4
        var approvedLeave = new com.swp391.scms.operations.entity.StaffInternalRequest();
        approvedLeave.setRequestType("LEAVE");
        approvedLeave.setStatus("APPROVED");
        approvedLeave.setStartDate(wed);
        approvedLeave.setEndDate(wed);

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(rooms.findAll()).thenReturn(java.util.List.of(studioA, studioB, closedRoom));
        when(coaches.findActiveWithUser()).thenReturn(java.util.List.of(coachClassBusy, coachPtBusy, coachOnLeave, coachFree));
        when(sessions.findScheduledSessionsBetweenDates(mon, wed))
                .thenReturn(java.util.List.of(yogaMorningSession, boxingSlot2Session));
        when(ptRepo.findConfirmedBetween(mon, wed)).thenReturn(java.util.List.of(ptSlot2));
        when(leaveRepo.findOverlappingLeaves(101L, mon, wed)).thenReturn(java.util.List.of());
        when(leaveRepo.findOverlappingLeaves(102L, mon, wed)).thenReturn(java.util.List.of());
        when(leaveRepo.findOverlappingLeaves(103L, mon, wed)).thenReturn(java.util.List.of(approvedLeave));
        when(leaveRepo.findOverlappingLeaves(104L, mon, wed)).thenReturn(java.util.List.of());

        var req = new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                1L,
                mon,
                LocalDate.of(2026, 10, 25),
                java.util.List.of("MONDAY", "WEDNESDAY"),
                ScheduleSlot.SLOT_2.startTime(),
                ScheduleSlot.SLOT_2.endTime()
        );

        var result = service.checkRecurringAvailability(req);

        assertThat(result.validSchedule()).isTrue();
        assertThat(result.sessionCount()).isEqualTo(2);
        assertThat(result.firstSessionDate()).isEqualTo(mon);
        assertThat(result.lastSessionDate()).isEqualTo(wed);
        assertThat(result.slots()).hasSize(5);
        assertThat(result.slots().stream().map(s -> s.code()).toList())
                .containsExactly("SLOT_1", "SLOT_2", "SLOT_3", "SLOT_4", "SLOT_5");

        // Slot 1: xung đột cùng bộ môn Yoga
        var slot1 = result.slots().get(0);
        assertThat(slot1.available()).isFalse();
        assertThat(slot1.disciplineConflict()).isTrue();
        assertThat(slot1.conflictCode()).isEqualTo("SCHEDULING_DISCIPLINE_CONFLICT");

        // Slot 2 (selected): khả dụng, còn 1/2 phòng trống và 1/4 HLV trống
        var slot2 = result.slots().get(1);
        assertThat(slot2.available()).isTrue();
        assertThat(slot2.disciplineConflict()).isFalse();
        assertThat(slot2.availableRoomCount()).isEqualTo(1);
        assertThat(slot2.availableCoachCount()).isEqualTo(1);
        assertThat(result.selectedSlotAvailable()).isTrue();

        // Phòng ở Slot 2: bỏ phòng maintenance, studioA trùng phòng, studioB trống
        assertThat(result.rooms()).hasSize(2);
        assertThat(result.rooms().get(0).id()).isEqualTo(10L);
        assertThat(result.rooms().get(0).available()).isFalse();
        assertThat(result.rooms().get(0).conflictCode()).isEqualTo("SCHEDULING_ROOM_CONFLICT");
        assertThat(result.rooms().get(1).id()).isEqualTo(11L);
        assertThat(result.rooms().get(1).available()).isTrue();

        // HLV ở Slot 2: 101 trùng lớp nhóm, 102 trùng PT 1:1, 103 nghỉ phép đã duyệt, 104 trống
        assertThat(result.coaches()).hasSize(4);
        assertThat(result.coaches().get(0).available()).isFalse();
        assertThat(result.coaches().get(0).conflictCode()).isEqualTo("SCHEDULING_COACH_CONFLICT");
        assertThat(result.coaches().get(1).available()).isFalse();
        assertThat(result.coaches().get(1).conflictCode()).isEqualTo("SCHEDULING_COACH_PT_CONFLICT");
        assertThat(result.coaches().get(2).available()).isFalse();
        assertThat(result.coaches().get(2).conflictCode()).isEqualTo("COACH_ON_LEAVE");
        assertThat(result.coaches().get(3).available()).isTrue();
        assertThat(result.coaches().get(3).conflictCode()).isNull();
    }

    /** Kiểm thử: checkRecurringAvailability đánh dấu slot quá khứ và trả về validSchedule=false khi cấu hình sai. */
    @Test
    @DisplayName("checkRecurringAvailability marks past slots and handles invalid date range, missing days, zero matches and invalid slots")
    void checkRecurringAvailability_marksPastSlotsAndValidatesInvalidSchedules() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");

        Room studio = new Room();
        studio.setId(10L);
        studio.setName("Zen Garden Studio");
        studio.setCapacity(16);
        studio.setStatus("available");

        var coachUser = new com.swp391.scms.users.entity.User();
        coachUser.setFullName("HLV Mai");
        coachUser.setEmail("mai@sol.vn");
        Coach coach = new Coach();
        coach.setUserId(101L);
        coach.setEmploymentStatus("active");
        coach.setUser(coachUser);

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));

        // 1. Ngày kết thúc trước ngày bắt đầu
        var badRange = service.checkRecurringAvailability(
                new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                        1L, LocalDate.of(2026, 10, 25), LocalDate.of(2026, 10, 20),
                        java.util.List.of("MONDAY"), null, null));
        assertThat(badRange.validSchedule()).isFalse();
        assertThat(badRange.scheduleErrorCode()).isEqualTo("SCHEDULING_INVALID_DATE_RANGE");
        assertThat(badRange.sessionCount()).isZero();

        // 2. Không chọn thứ trong tuần
        var noDays = service.checkRecurringAvailability(
                new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                        1L, LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 25),
                        java.util.List.of(), null, null));
        assertThat(noDays.validSchedule()).isFalse();
        assertThat(noDays.scheduleErrorCode()).isEqualTo("SCHEDULING_NO_RECURRING_DAYS");

        // 3. Không có ngày nào khớp trong khoảng
        var noMatches = service.checkRecurringAvailability(
                new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                        1L, LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 21), // Thứ 3 & Thứ 4
                        java.util.List.of("SUNDAY"), null, null));
        assertThat(noMatches.validSchedule()).isFalse();
        assertThat(noMatches.scheduleErrorCode()).isEqualTo("SCHEDULING_NO_SESSIONS_MATCHED");

        // 4. Khung giờ ngoài 5 slot cố định
        var badSlot = service.checkRecurringAvailability(
                new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                        1L, LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 25),
                        java.util.List.of("MONDAY"), LocalTime.of(8, 0), LocalTime.of(9, 0)));
        assertThat(badSlot.validSchedule()).isFalse();
        assertThat(badSlot.scheduleErrorCode()).isEqualTo("SCHEDULING_INVALID_SLOT");

        // 5. Hôm nay (10:00 giờ VN ngày 2026-10-16, Thứ 6): Slot 1 (07:00) & Slot 2 (09:45) là quá khứ; Slot 3..5 khả dụng; null start/end mặc định SLOT_1
        when(rooms.findAll()).thenReturn(java.util.List.of(studio));
        when(coaches.findActiveWithUser()).thenReturn(java.util.List.of(coach));
        when(sessions.findScheduledSessionsBetweenDates(LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 16)))
                .thenReturn(java.util.List.of());

        var todayRes = service.checkRecurringAvailability(
                new com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest(
                        1L, LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 16),
                        java.util.List.of("FRIDAY"), null, null));
        assertThat(todayRes.validSchedule()).isTrue();
        assertThat(todayRes.selectedSlotAvailable()).isFalse();
        assertThat(todayRes.selectedSlotConflictCode()).isEqualTo("SCHEDULING_PAST_SESSION");
        assertThat(todayRes.slots().get(0).conflictCode()).isEqualTo("SCHEDULING_PAST_SESSION");
        assertThat(todayRes.slots().get(1).conflictCode()).isEqualTo("SCHEDULING_PAST_SESSION");
        assertThat(todayRes.slots().get(2).available()).isTrue();
        assertThat(todayRes.slots().get(3).available()).isTrue();
        assertThat(todayRes.slots().get(4).available()).isTrue();
    }

    /** Kiểm thử: createClass từ chối buổi đầu ngoài 5 slot cố định. */
    @Test
    @DisplayName("createClass rejects initial session outside the 5 canonical slots")
    void createClass_rejectsNonCanonicalSlot() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Coach activeCoach = new Coach();
        activeCoach.setUserId(2L);
        activeCoach.setEmploymentStatus("active");
        Room studio = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(studio, "id", 3L);
        studio.setStatus("available");

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(coaches.findById(2L)).thenReturn(Optional.of(activeCoach));
        when(rooms.findById(3L)).thenReturn(Optional.of(studio));

        var req = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest(
                "Yoga Sáng", 1L, 2L, 3L, 15, "all", "desc",
                LocalDate.of(2026, 10, 20), LocalTime.of(8, 0), LocalTime.of(9, 0));

        assertThatThrownBy(() -> service.createClass(req))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_INVALID_SLOT")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.invalid_slot");
    }
}
