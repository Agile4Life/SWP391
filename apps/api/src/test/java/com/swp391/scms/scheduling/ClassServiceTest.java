package com.swp391.scms.scheduling;

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
                LocalTime.of(14, 0),
                LocalTime.of(15, 0)
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

        // Đồng hồ đang ở 10:00:00, buổi học diễn ra lúc 09:00:00 hôm nay
        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0)
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

        // Đồng hồ đang ở 10:00:00, buổi học diễn ra lúc 11:00:00 hôm nay
        CreateSessionRequest request = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                LocalTime.of(11, 0),
                LocalTime.of(12, 0)
        );

        ClassSessionDto result = service.createSession(1L, request);
        assertThat(result).isNotNull();
        assertThat(result.startTime()).isEqualTo(LocalTime.of(11, 0));
        assertThat(result.endTime()).isEqualTo(LocalTime.of(12, 0));
    }

    /** Kiểm thử: cho phép các buổi liền kề nhau. */
    @Test
    @DisplayName("createSession allows two adjacent sessions (end time of first equals start time of second)")
    void createSession_allowsAdjacentSessions() {
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> i.getArgument(0));

        // Buổi 1: 14:00 - 15:00
        CreateSessionRequest session1Req = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                LocalTime.of(14, 0),
                LocalTime.of(15, 0)
        );
        ClassSessionDto session1 = service.createSession(1L, session1Req);
        assertThat(session1.startTime()).isEqualTo(LocalTime.of(14, 0));
        assertThat(session1.endTime()).isEqualTo(LocalTime.of(15, 0));

        // Buổi 2: 15:00 - 16:00 (liền kề ngay sau Buổi 1)
        CreateSessionRequest session2Req = new CreateSessionRequest(
                LocalDate.of(2026, 10, 16),
                LocalTime.of(15, 0),
                LocalTime.of(16, 0)
        );
        ClassSessionDto session2 = service.createSession(1L, session2Req);
        assertThat(session2.startTime()).isEqualTo(LocalTime.of(15, 0));
        assertThat(session2.endTime()).isEqualTo(LocalTime.of(16, 0));

        // Kiểm tra tính liền kề: session1.endTime bằng session2.startTime
        assertThat(session1.endTime()).isEqualTo(session2.startTime());
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
        session.setStartTime(LocalTime.of(8, 0));
        session.setEndTime(LocalTime.of(9, 0));
        session.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(100L)).thenReturn(Optional.of(session));
        when(sessions.saveAndFlush(any(ClassSession.class))).thenAnswer(i -> i.getArgument(0));

        RescheduleSessionRequest req = new RescheduleSessionRequest(
                LocalDate.of(2026, 10, 20),
                LocalTime.of(18, 0),
                LocalTime.of(19, 30)
        );

        ClassSessionDto dto = service.rescheduleSession(1L, 100L, req);
        assertThat(dto.sessionDate()).isEqualTo(LocalDate.of(2026, 10, 20));
        assertThat(dto.startTime()).isEqualTo(LocalTime.of(18, 0));
        assertThat(dto.endTime()).isEqualTo(LocalTime.of(19, 30));
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
        session.setStartTime(LocalTime.of(8, 0));
        session.setEndTime(LocalTime.of(9, 0));
        session.setStatus("scheduled");

        GymClass boxing = new GymClass();
        boxing.setName("Boxing Cơ Bản");
        ClassSession other = new ClassSession();
        other.setGymClass(boxing);
        other.setStartTime(LocalTime.of(18, 0));
        other.setEndTime(LocalTime.of(20, 0));

        LocalDate date = LocalDate.of(2026, 10, 20);
        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(100L)).thenReturn(Optional.of(session));
        when(sessions.findMemberOverlaps(1L, 100L, date, LocalTime.of(19, 0), LocalTime.of(20, 0)))
                .thenReturn(java.util.List.of(other));

        assertThatThrownBy(() -> service.rescheduleSession(1L, 100L,
                new RescheduleSessionRequest(date, LocalTime.of(19, 0), LocalTime.of(20, 0))))
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
        existingSession.setStartTime(LocalTime.of(8, 0));
        existingSession.setEndTime(LocalTime.of(9, 30));
        existingSession.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.searchSessions(LocalDate.of(2026, 10, 18), LocalDate.of(2026, 10, 18), null, null))
                .thenReturn(java.util.List.of(existingSession));

        CreateSessionRequest overlappingReq = new CreateSessionRequest(
                LocalDate.of(2026, 10, 18),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0)
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
        existingSession.setStartTime(LocalTime.of(18, 0));
        existingSession.setEndTime(LocalTime.of(19, 30));
        existingSession.setStatus("scheduled");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.searchSessions(LocalDate.of(2026, 10, 18), LocalDate.of(2026, 10, 18), null, null))
                .thenReturn(java.util.List.of(existingSession));

        CreateSessionRequest overlappingReq = new CreateSessionRequest(
                LocalDate.of(2026, 10, 18),
                LocalTime.of(18, 30),
                LocalTime.of(20, 0)
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
        pt.setStartTime(LocalTime.of(18, 0));
        pt.setEndTime(LocalTime.of(19, 0));
        pt.setStatus("confirmed");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(ptRepo.findActiveByCoachAndDate(coach.getUserId(), futureDate)).thenReturn(java.util.List.of(pt));

        assertThatThrownBy(() -> service.createSession(1L, new CreateSessionRequest(futureDate, LocalTime.of(18, 30), LocalTime.of(19, 30))))
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
        existing.setStartTime(LocalTime.of(10, 0));
        existing.setEndTime(LocalTime.of(11, 0));
        existing.setStatus("scheduled");

        var busyPt = new com.swp391.scms.coaching.entity.CoachBooking();
        busyPt.setCoach(coach);
        busyPt.setBookingDate(newDate);
        busyPt.setStartTime(LocalTime.of(14, 0));
        busyPt.setEndTime(LocalTime.of(15, 0));
        busyPt.setStatus("confirmed");

        when(gymClasses.findById(1L)).thenReturn(Optional.of(gymClass));
        when(sessions.findById(55L)).thenReturn(Optional.of(existing));
        when(ptRepo.findActiveByCoachAndDate(coach.getUserId(), newDate)).thenReturn(java.util.List.of(busyPt));

        // 1. Dời đè lên buổi PT 1:1 → bị từ chối
        assertThatThrownBy(() -> service.rescheduleSession(1L, 55L, new RescheduleSessionRequest(newDate, LocalTime.of(14, 0), LocalTime.of(15, 0))))
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
        when(sessions.findMemberOverlaps(1L, 55L, newDate, LocalTime.of(16, 0), LocalTime.of(17, 0))).thenReturn(java.util.List.of());
        when(sessions.saveAndFlush(existing)).thenReturn(existing);
        when(enrollments.findByGymClassId(1L)).thenReturn(java.util.List.of(enrollment20));
        when(sessionBookings.findBySessionIdAndStatus(55L, "booked")).thenReturn(java.util.List.of(duplicateBooking20));

        service.rescheduleSession(1L, 55L, new RescheduleSessionRequest(newDate, LocalTime.of(16, 0), LocalTime.of(17, 0)));

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

    /** Kiểm thử: quy tắc mỗi bộ môn chỉ có tối đa 1 lớp đang hoạt động (active) trên cả create & update. */
    @Test
    @DisplayName("createRecurringClass and updateClass reject a second active class for the same discipline")
    void enforcesSingleActiveClassPerDiscipline() {
        Discipline yoga = new Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 1L);
        yoga.setName("Yoga");
        Coach activeCoach = new Coach();
        activeCoach.setUserId(2L);
        activeCoach.setEmploymentStatus("active");
        Room studio = new Room();
        org.springframework.test.util.ReflectionTestUtils.setField(studio, "id", 3L);
        studio.setStatus("available");
        studio.setName("Zen Garden Studio");

        when(disciplines.findById(1L)).thenReturn(Optional.of(yoga));
        when(gymClasses.existsByDisciplineIdAndStatus(1L, "active")).thenReturn(true);

        var createReq = new com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest(
                "Yoga Buổi Tối",
                1L,
                2L,
                3L,
                15,
                "all",
                "desc",
                java.math.BigDecimal.ZERO,
                LocalDate.of(2026, 10, 20),
                LocalDate.of(2026, 11, 20),
                java.util.List.of("MONDAY"),
                LocalTime.of(18, 0),
                LocalTime.of(19, 0)
        );

        assertThatThrownBy(() -> service.createRecurringClass(createReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CLASS_EXISTS");

        // updateClass: kích hoạt lại hoặc chuyển sang bộ môn đã có lớp active khác → bị từ chối
        GymClass archivedClass = new GymClass();
        archivedClass.setId(9L);
        archivedClass.setStatus("archived");
        archivedClass.setDiscipline(yoga);
        archivedClass.setCoach(activeCoach);
        archivedClass.setRoom(studio);

        when(gymClasses.findById(9L)).thenReturn(Optional.of(archivedClass));
        when(gymClasses.existsByDisciplineIdAndStatusAndIdNot(1L, "active", 9L)).thenReturn(true);

        var reactivateReq = new UpdateClassRequest(
                "Yoga Cũ", 1L, 2L, 3L, 15, "all", "desc", "active"
        );
        assertThatThrownBy(() -> service.updateClass(9L, reactivateReq))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_DISCIPLINE_CLASS_EXISTS");

        // updateClass: cập nhật sang archived thì luôn cho phép dù bộ môn đã có lớp active khác
        when(coaches.findById(2L)).thenReturn(Optional.of(activeCoach));
        when(rooms.findById(3L)).thenReturn(Optional.of(studio));
        when(enrollments.countByGymClassIdAndStatus(9L, "booked")).thenReturn(0L);
        when(gymClasses.saveAndFlush(archivedClass)).thenReturn(archivedClass);

        var keepArchivedReq = new UpdateClassRequest(
                "Yoga Cũ (đã đóng)", 1L, 2L, 3L, 15, "all", "desc", "archived"
        );
        var updated = service.updateClass(9L, keepArchivedReq);
        assertThat(updated.name()).isEqualTo("Yoga Cũ (đã đóng)");
    }
}
