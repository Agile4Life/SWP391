package com.swp391.scms.facilities;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.SessionEvaluationRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.EquipmentRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/** Bộ kiểm thử cho RetiredCatalogCleanupRunner (dọn dữ liệu bộ môn/phòng/lớp cũ và đồng bộ HLV demo). */
@ExtendWith(MockitoExtension.class)
class RetiredCatalogCleanupRunnerTest {

    @Mock DisciplineRepository disciplines;
    @Mock RoomRepository rooms;
    @Mock GymClassRepository classes;
    @Mock ClassSessionRepository sessions;
    @Mock ClassEnrollmentRepository enrollments;
    @Mock SessionBookingRepository sessionBookings;
    @Mock EquipmentRepository equipment;
    @Mock CoachBookingRepository coachBookings;
    @Mock MemberRepository members;
    @Mock CoachRepository coaches;
    @Mock TrainingPlanRepository trainingPlans;
    @Mock SessionAttendanceRepository sessionAttendances;
    @Mock SessionEvaluationRepository sessionEvaluations;
    @Mock JdbcTemplate jdbcTemplate;

    private RetiredCatalogCleanupRunner runner() {
        var r = new RetiredCatalogCleanupRunner(
                disciplines, rooms, classes, sessions, enrollments,
                sessionBookings, equipment, coachBookings, members, coaches);
        r.setTrainingPlans(trainingPlans);
        r.setSessionAttendances(sessionAttendances);
        r.setSessionEvaluations(sessionEvaluations);
        r.setJdbcTemplate(jdbcTemplate);
        return r;
    }

    /** Kiểm thử: xóa lớp cũ không có dữ liệu liên kết, chỉ đặt inactive với lớp đã có ghi danh/đặt chỗ. */
    @Test
    void deletesUnusedRetiredClassesAndDeactivatesUsedOnes() {
        Discipline tennis = discipline(4L, "Tennis");
        Discipline swimming = discipline(2L, "Bơi lội");
        Discipline gym = discipline(1L, "Gym");

        GymClass unusedTennis = gymClass(10L, "Tennis Kỹ Thuật Cơ Bản", tennis, "active");
        GymClass usedSwim = gymClass(11L, "Bơi Cơ Bản Người Lớn", swimming, "active");
        GymClass activeGym = gymClass(12L, "Full Body Strength 101", gym, "active");

        when(classes.findAll()).thenReturn(List.of(unusedTennis, usedSwim, activeGym));
        when(enrollments.findByGymClassId(10L)).thenReturn(List.of());
        when(enrollments.findByGymClassId(11L)).thenReturn(List.of(new ClassEnrollment()));
        when(sessionBookings.existsBySessionGymClassId(10L)).thenReturn(false);
        when(trainingPlans.existsByGymClassId(10L)).thenReturn(false);
        when(sessionAttendances.existsBySessionGymClassId(10L)).thenReturn(false);
        when(sessionEvaluations.existsBySessionGymClassId(10L)).thenReturn(false);
        when(rooms.findAll()).thenReturn(List.of());
        when(disciplines.findAll()).thenReturn(List.of());
        when(coaches.findAll()).thenReturn(List.of());

        runner().run(null);

        verify(sessions).deleteByGymClassId(10L);
        verify(classes).delete(unusedTennis);
        assertThat(usedSwim.getStatus()).isEqualTo("inactive");
        verify(classes).save(usedSwim);
        verify(classes, never()).delete(usedSwim);
        verify(classes, never()).delete(activeGym);
        assertThat(activeGym.getStatus()).isEqualTo("active");
    }

    /** Kiểm thử: gỡ cấu hình sân cũ, xóa phòng đã ngừng chưa dùng và đóng phòng đang còn lớp/thiết bị/bản ghi cũ. */
    @Test
    void clearsLegacyRoomConfigDeletesUnusedRetiredRoomsAndClosesReferencedOnes() {
        Discipline tennis = discipline(4L, "Tennis");
        Room unusedPool = room(20L, "Oasis Lap Pool", "available", tennis, LocalTime.of(6, 0), LocalTime.of(22, 0));
        Room usedTennis = room(21L, "Sân Tennis 01", "available", tennis, LocalTime.of(6, 0), LocalTime.of(22, 0));
        Room legacyCourtRoom = room(22L, "Sân Cầu lông 01", "available", null, null, null);
        Room keptGym = room(23L, "Phòng Gym Tiêu chuẩn", "available", null, null, null);

        when(classes.findAll()).thenReturn(List.of());
        when(rooms.findAll()).thenReturn(List.of(unusedPool, usedTennis, legacyCourtRoom, keptGym));
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class))).thenReturn(true);
        when(classes.existsByRoomId(20L)).thenReturn(false);
        when(equipment.existsByRoomId(20L)).thenReturn(false);
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), eq(20L))).thenReturn(false);
        when(classes.existsByRoomId(21L)).thenReturn(true);
        when(classes.existsByRoomId(22L)).thenReturn(false);
        when(equipment.existsByRoomId(22L)).thenReturn(false);
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), eq(22L))).thenReturn(true);
        when(disciplines.findAll()).thenReturn(List.of());
        when(coaches.findAll()).thenReturn(List.of());

        runner().run(null);

        assertThat(unusedPool.getDiscipline()).isNull();
        assertThat(unusedPool.getOpenTime()).isNull();
        assertThat(unusedPool.getCloseTime()).isNull();
        verify(rooms).delete(unusedPool);

        assertThat(usedTennis.getDiscipline()).isNull();
        assertThat(usedTennis.getStatus()).isEqualTo("closed");
        verify(rooms).save(usedTennis);
        verify(rooms, never()).delete(usedTennis);

        assertThat(legacyCourtRoom.getStatus()).isEqualTo("closed");
        verify(rooms).save(legacyCourtRoom);
        verify(rooms, never()).delete(legacyCourtRoom);

        verify(rooms, never()).delete(keptGym);
        verify(rooms, never()).save(keptGym);
    }

    /** Kiểm thử: xóa liên kết bộ môn yêu thích rồi xóa bộ môn cũ chưa dùng, giữ nguyên bộ môn còn tham chiếu lịch sử. */
    @Test
    void removesFavoritesAndDeletesOnlyUnusedRetiredDisciplines() {
        Discipline unusedBadminton = discipline(5L, "Cầu lông");
        Discipline usedSwimming = discipline(2L, "Bơi lội");
        Discipline activeGym = discipline(1L, "Gym");

        when(classes.findAll()).thenReturn(List.of());
        when(rooms.findAll()).thenReturn(List.of());
        when(disciplines.findAll()).thenReturn(List.of(unusedBadminton, usedSwimming, activeGym));
        when(classes.existsByDisciplineId(5L)).thenReturn(false);
        when(rooms.existsByDisciplineId(5L)).thenReturn(false);
        when(coachBookings.existsByDisciplineId(5L)).thenReturn(false);
        when(classes.existsByDisciplineId(2L)).thenReturn(false);
        when(rooms.existsByDisciplineId(2L)).thenReturn(false);
        when(coachBookings.existsByDisciplineId(2L)).thenReturn(true);
        when(coaches.findAll()).thenReturn(List.of());

        runner().run(null);

        verify(members).removeFavoriteDiscipline(5L);
        verify(disciplines).delete(unusedBadminton);
        verify(members).removeFavoriteDiscipline(2L);
        verify(disciplines, never()).delete(usedSwimming);
        verify(members, never()).removeFavoriteDiscipline(1L);
        verify(disciplines, never()).delete(activeGym);
    }

    /** Kiểm thử: đồng bộ chuyên môn hai HLV demo cũ và lũy đẳng ở lần chạy lại. */
    @Test
    void updatesRetiredDemoCoachSpecializationsIdempotently() {
        Coach longCoach = coach("long@demo.sol.vn", "Phan Thành Long", "Boxing & Tennis", "AIBA Level 2",
                "Cựu vận động viên Boxing & Tennis, chuyên kỹ thuật đấm, di chuyển chân và thể lực.");
        Coach thaoCoach = coach("thao@demo.sol.vn", "Vũ Phương Thảo", "Bơi lội & Cầu lông", "ASCA Level 2",
                "Huấn luyện viên Bơi lội & Cầu lông 7 năm kinh nghiệm: kỹ thuật, sức bền và phản xạ.");
        Coach hungCoach = coach("hung@demo.sol.vn", "Trịnh Quang Hùng", "Gym - Sức mạnh", "NSCA-CPT",
                "8 năm huấn luyện sức mạnh.");

        lenient().when(classes.findAll()).thenReturn(List.of());
        lenient().when(rooms.findAll()).thenReturn(List.of());
        lenient().when(disciplines.findAll()).thenReturn(List.of());
        when(coaches.findAll()).thenReturn(List.of(longCoach, thaoCoach, hungCoach));

        var cleanup = runner();
        cleanup.run(null);

        assertThat(longCoach.getSpecialization()).isEqualTo("Boxing");
        assertThat(longCoach.getBio()).doesNotContain("Tennis");
        assertThat(thaoCoach.getSpecialization()).isEqualTo("Yoga & Phục hồi");
        assertThat(thaoCoach.getCertification()).isEqualTo("RYT-200");
        assertThat(thaoCoach.getBio()).doesNotContain("Bơi lội").doesNotContain("Cầu lông");
        verify(coaches).save(longCoach);
        verify(coaches).save(thaoCoach);
        verify(coaches, never()).save(hungCoach);

        // Chạy lần 2 không ghi lại lần nào nữa (idempotent).
        cleanup.run(null);
        verify(coaches).save(longCoach);
        verify(coaches).save(thaoCoach);
    }

    /** Kiểm thử: giữ nguyên nhiều lớp đang hoạt động (active) trong cùng một bộ môn (không xóa hay vô hiệu hóa trùng bộ môn). */
    @Test
    void preservesMultipleActiveClassesWithinSameDiscipline() {
        Discipline gym = discipline(1L, "Gym");
        GymClass morningStrength = gymClass(10L, "Full Body Strength 101", gym, "active");
        GymClass eveningKettlebell = gymClass(11L, "Kettlebell Conditioning", gym, "active");
        GymClass hiitBurn = gymClass(12L, "HIIT Burn", gym, "active");

        when(classes.findAll()).thenReturn(List.of(morningStrength, eveningKettlebell, hiitBurn));
        lenient().when(rooms.findAll()).thenReturn(List.of());
        lenient().when(disciplines.findAll()).thenReturn(List.of(gym));
        lenient().when(coaches.findAll()).thenReturn(List.of());

        runner().run(null);

        assertThat(morningStrength.getStatus()).isEqualTo("active");
        assertThat(eveningKettlebell.getStatus()).isEqualTo("active");
        assertThat(hiitBurn.getStatus()).isEqualTo("active");
        verify(classes, never()).delete(any());
        verify(classes, never()).save(any());
        verify(sessions, never()).deleteByGymClassId(any());
    }

    /** Kiểm thử P2-BE-24: khi chuyển lớp đã ngừng có dữ liệu liên kết sang inactive, hủy toàn bộ buổi scheduled tương lai để tránh buổi ma. */
    @Test
    void cancelsFutureScheduledSessionsOfDeactivatedRetiredClass() {
        Discipline swimming = discipline(2L, "Bơi lội");
        GymClass usedSwim = gymClass(11L, "Bơi Cơ Bản Người Lớn", swimming, "active");

        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        var pastCompleted = new com.swp391.scms.scheduling.entity.ClassSession();
        pastCompleted.setId(101L);
        pastCompleted.setGymClass(usedSwim);
        pastCompleted.setSessionDate(today.minusDays(5));
        pastCompleted.setStatus("completed");

        var futureScheduled = new com.swp391.scms.scheduling.entity.ClassSession();
        futureScheduled.setId(102L);
        futureScheduled.setGymClass(usedSwim);
        futureScheduled.setSessionDate(today.plusDays(3));
        futureScheduled.setStatus("scheduled");

        when(classes.findAll()).thenReturn(List.of(usedSwim));
        when(enrollments.findByGymClassId(11L)).thenReturn(List.of(new ClassEnrollment()));
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(11L))
                .thenReturn(List.of(pastCompleted, futureScheduled));
        when(rooms.findAll()).thenReturn(List.of());
        when(disciplines.findAll()).thenReturn(List.of());
        when(coaches.findAll()).thenReturn(List.of());

        runner().run(null);

        assertThat(usedSwim.getStatus()).isEqualTo("inactive");
        assertThat(pastCompleted.getStatus()).isEqualTo("completed");
        assertThat(futureScheduled.getStatus()).isEqualTo("cancelled");
        assertThat(futureScheduled.getCancelReason()).isEqualTo("Lớp học ngừng hoạt động");
        verify(sessions).save(futureScheduled);
        verify(sessions, never()).save(pastCompleted);
    }

    /** Kiểm thử: an toàn khi mọi repository tùy chọn đều null (môi trường unit test tối giản). */
    @Test
    void safeWhenOptionalRepositoriesAreNull() {
        var minimal = new RetiredCatalogCleanupRunner(null, null, null, null, null, null, null, null, null, null);
        minimal.run(null);
    }

    private static Discipline discipline(Long id, String name) {
        Discipline d = new Discipline();
        ReflectionTestUtils.setField(d, "id", id);
        d.setName(name);
        return d;
    }

    private static GymClass gymClass(Long id, String name, Discipline discipline, String status) {
        GymClass c = new GymClass();
        c.setId(id);
        c.setName(name);
        c.setDiscipline(discipline);
        c.setStatus(status);
        return c;
    }

    private static Room room(Long id, String name, String status, Discipline discipline, LocalTime open, LocalTime close) {
        Room r = new Room();
        r.setId(id);
        r.setName(name);
        r.setStatus(status);
        r.setDiscipline(discipline);
        r.setOpenTime(open);
        r.setCloseTime(close);
        return r;
    }

    private static Coach coach(String email, String fullName, String specialization, String certification, String bio) {
        User u = new User();
        u.setEmail(email);
        u.setFullName(fullName);
        Coach c = new Coach();
        c.setUser(u);
        c.setSpecialization(specialization);
        c.setCertification(certification);
        c.setBio(bio);
        return c;
    }
}
