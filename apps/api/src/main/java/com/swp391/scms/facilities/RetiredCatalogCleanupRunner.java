package com.swp391.scms.facilities;

import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.CoachReviewRepository;
import com.swp391.scms.coaching.repository.SessionEvaluationRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.EquipmentRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chạy lũy đẳng (idempotent) khi khởi động để dọn dẹp dữ liệu các bộ môn đã ngừng (Bơi lội, Tennis, Cầu lông),
 * các phòng/sân cũ tương ứng, các lớp demo cũ và chuyên môn cũ của HLV demo trên những CSDL đã chạy trước đó,
 * đồng thời bảo toàn toàn vẹn khóa ngoại cho mọi dữ liệu lịch sử còn liên kết.
 */
@Component
@Order(220)
public class RetiredCatalogCleanupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RetiredCatalogCleanupRunner.class);
    private static final java.time.ZoneId CENTER_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String CLASS_DEACTIVATED_REASON = "Lớp học ngừng hoạt động";

    static final Set<String> RETIRED_DISCIPLINES = Set.of(
            "bơi lội",
            "tennis",
            "cầu lông",
            "thermal aquatics"
    );

    static final Set<String> RETIRED_ROOMS = Set.of(
            "oasis lap pool",
            "sân tennis 01",
            "sân tennis 02",
            "sân cầu lông 01",
            "sân cầu lông 02",
            "sân cầu lông 03",
            "sân cầu lông 04",
            "làn bơi 01",
            "làn bơi 02"
    );

    static final Set<String> RETIRED_DEMO_CLASSES = Set.of(
            "bơi cơ bản người lớn",
            "tennis kỹ thuật cơ bản",
            "cầu lông bộ chân & đánh đôi"
    );

    private static final String LONG_EMAIL = "long@demo.sol.vn";
    private static final String LONG_NAME = "Phan Thành Long";
    private static final String LONG_BIO = "Cựu vận động viên Boxing, chuyên kỹ thuật đấm, di chuyển chân và thể lực.";

    private static final String THAO_EMAIL = "thao@demo.sol.vn";
    private static final String THAO_NAME = "Vũ Phương Thảo";
    private static final String THAO_BIO = "Huấn luyện viên Yoga & Phục hồi 7 năm kinh nghiệm: hơi thở, giãn cơ và phục hồi thể lực.";

    private final DisciplineRepository disciplines;
    private final RoomRepository rooms;
    private final GymClassRepository classes;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final SessionBookingRepository sessionBookings;
    private final EquipmentRepository equipment;
    private final CoachBookingRepository coachBookings;
    private final MemberRepository members;
    private final CoachRepository coaches;

    @Autowired(required = false)
    private TrainingPlanRepository trainingPlans;

    @Autowired(required = false)
    private SessionAttendanceRepository sessionAttendances;

    @Autowired(required = false)
    private SessionEvaluationRepository sessionEvaluations;

    @Autowired(required = false)
    private CoachReviewRepository coachReviews;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    /** Nhận các repository dùng cho dọn dẹp; mọi tham số đều có thể null trong unit test. */
    @Autowired
    public RetiredCatalogCleanupRunner(
            @Autowired(required = false) DisciplineRepository disciplines,
            @Autowired(required = false) RoomRepository rooms,
            @Autowired(required = false) GymClassRepository classes,
            @Autowired(required = false) ClassSessionRepository sessions,
            @Autowired(required = false) ClassEnrollmentRepository enrollments,
            @Autowired(required = false) SessionBookingRepository sessionBookings,
            @Autowired(required = false) EquipmentRepository equipment,
            @Autowired(required = false) CoachBookingRepository coachBookings,
            @Autowired(required = false) MemberRepository members,
            @Autowired(required = false) CoachRepository coaches) {
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.classes = classes;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.sessionBookings = sessionBookings;
        this.equipment = equipment;
        this.coachBookings = coachBookings;
        this.members = members;
        this.coaches = coaches;
    }

    /** Gán repository giáo án (tùy chọn, dùng cho kiểm tra khóa ngoại trước khi xóa lớp). */
    public void setTrainingPlans(TrainingPlanRepository trainingPlans) {
        this.trainingPlans = trainingPlans;
    }

    /** Gán repository điểm danh buổi học (tùy chọn). */
    public void setSessionAttendances(SessionAttendanceRepository sessionAttendances) {
        this.sessionAttendances = sessionAttendances;
    }

    /** Gán repository đánh giá buổi học (tùy chọn). */
    public void setSessionEvaluations(SessionEvaluationRepository sessionEvaluations) {
        this.sessionEvaluations = sessionEvaluations;
    }

    /** Gán repository đánh giá HLV (tùy chọn). */
    public void setCoachReviews(CoachReviewRepository coachReviews) {
        this.coachReviews = coachReviews;
    }

    /** Gán JdbcTemplate (tùy chọn, dùng kiểm tra bảng đặt sân cũ nếu còn tồn tại trên CSDL cũ). */
    public void setJdbcTemplate(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Thứ tự an toàn khóa ngoại: (1) dọn lớp thuộc bộ môn đã ngừng / lớp demo cũ, (2) gỡ gắn bộ môn & giờ sân
     * rồi dọn phòng cũ chưa dùng (hoặc đóng phòng đã dùng), (3) gỡ liên kết bộ môn yêu thích rồi xóa bộ môn đã
     * ngừng nếu không còn tham chiếu, (4) cập nhật chuyên môn của HLV demo cũ.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        cleanupRetiredClasses();
        cleanupRetiredRooms();
        cleanupRetiredDisciplines();
        syncDemoCoachSpecializations();
    }

    /**
     * Xóa lớp cũ nếu chưa có dữ liệu liên kết; nếu đã có dữ liệu lịch sử thì chuyển trạng thái sang inactive
     * và hủy toàn bộ buổi học {@code scheduled} tương lai để không gây buổi ma chặn phòng/HLV.
     */
    private void cleanupRetiredClasses() {
        if (classes == null) {
            return;
        }
        List<GymClass> allClasses = safeList(classes.findAll());
        java.time.LocalDate today = java.time.LocalDate.now(CENTER_ZONE);
        java.time.LocalDateTime now = java.time.LocalDateTime.now(CENTER_ZONE);
        int deleted = 0;
        int deactivated = 0;
        int cancelledSessions = 0;
        for (GymClass gymClass : allClasses) {
            if (!isRetiredClass(gymClass)) {
                continue;
            }
            Long classId = gymClass.getId();
            if (hasClassDependents(classId)) {
                if (!"inactive".equalsIgnoreCase(gymClass.getStatus())) {
                    gymClass.setStatus("inactive");
                    classes.save(gymClass);
                    deactivated++;
                }
                if (sessions != null && classId != null) {
                    for (ClassSession session : safeList(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId))) {
                        if (session != null && "scheduled".equalsIgnoreCase(session.getStatus())
                                && session.getSessionDate() != null
                                && !session.getSessionDate().isBefore(today)) {
                            session.setStatus("cancelled");
                            session.setCancelReason(CLASS_DEACTIVATED_REASON);
                            session.setUpdatedAt(now);
                            sessions.save(session);
                            cancelledSessions++;
                        }
                    }
                }
            } else {
                if (sessions != null && classId != null) {
                    sessions.deleteByGymClassId(classId);
                }
                classes.delete(gymClass);
                classes.flush();
                deleted++;
            }
        }
        if (deleted > 0 || deactivated > 0 || cancelledSessions > 0) {
            log.info("Retired catalog cleanup: {} retired classes deleted, {} set inactive, {} future sessions cancelled.",
                    deleted, deactivated, cancelledSessions);
        }
    }

    /** Gỡ liên kết bộ môn/giờ đặt sân cũ trên phòng và xóa phòng đã ngừng nếu không còn lớp/thiết bị/bản ghi cũ. */
    private void cleanupRetiredRooms() {
        if (rooms == null) {
            return;
        }
        boolean hasLegacyCourtTable = legacyCourtBookingsTableExists();
        int deleted = 0;
        int closed = 0;
        for (Room room : safeList(rooms.findAll())) {
            if (room == null) {
                continue;
            }
            boolean clearedLegacyConfig = false;
            if (room.getDiscipline() != null || room.getOpenTime() != null || room.getCloseTime() != null) {
                room.setDiscipline(null);
                room.setOpenTime(null);
                room.setCloseTime(null);
                clearedLegacyConfig = true;
            }
            boolean retired = room.getName() != null && RETIRED_ROOMS.contains(normalize(room.getName()));
            if (!retired) {
                if (clearedLegacyConfig) {
                    rooms.save(room);
                    rooms.flush();
                }
                continue;
            }
            Long roomId = room.getId();
            boolean inUse = roomId != null && (
                    (classes != null && classes.existsByRoomId(roomId))
                    || (equipment != null && equipment.existsByRoomId(roomId))
                    || (hasLegacyCourtTable && hasLegacyCourtBookingsForRoom(roomId))
            );
            if (inUse) {
                boolean needsClose = !"closed".equalsIgnoreCase(room.getStatus());
                if (needsClose) {
                    room.setStatus("closed");
                    closed++;
                }
                if (clearedLegacyConfig || needsClose) {
                    rooms.save(room);
                    rooms.flush();
                }
            } else {
                rooms.delete(room);
                rooms.flush();
                deleted++;
            }
        }
        if (deleted > 0 || closed > 0) {
            log.info("Retired catalog cleanup: {} retired rooms deleted, {} closed.", deleted, closed);
        }
    }

    /** Gỡ liên kết bộ môn yêu thích cho các bộ môn đã ngừng và xóa bộ môn nếu không còn lớp/phòng/buổi PT dùng. */
    private void cleanupRetiredDisciplines() {
        if (disciplines == null) {
            return;
        }
        int deleted = 0;
        for (Discipline discipline : safeList(disciplines.findAll())) {
            if (discipline == null || discipline.getName() == null
                    || !RETIRED_DISCIPLINES.contains(normalize(discipline.getName()))) {
                continue;
            }
            Long disciplineId = discipline.getId();
            if (members != null && disciplineId != null) {
                members.removeFavoriteDiscipline(disciplineId);
            }
            boolean inUse = disciplineId != null && (
                    (classes != null && classes.existsByDisciplineId(disciplineId))
                    || (rooms != null && rooms.existsByDisciplineId(disciplineId))
                    || (coachBookings != null && coachBookings.existsByDisciplineId(disciplineId))
            );
            if (!inUse) {
                disciplines.delete(discipline);
                disciplines.flush();
                deleted++;
            }
        }
        if (deleted > 0) {
            log.info("Retired catalog cleanup: {} retired disciplines deleted.", deleted);
        }
    }

    /** Đồng bộ chuyên môn của hai HLV demo cũ (Phan Thành Long -> Boxing, Vũ Phương Thảo -> Yoga & Phục hồi). */
    private void syncDemoCoachSpecializations() {
        if (coaches == null) {
            return;
        }
        int updated = 0;
        for (Coach coach : safeList(coaches.findAll())) {
            if (coach == null) {
                continue;
            }
            User user = coach.getUser();
            String email = user != null ? user.getEmail() : null;
            String fullName = user != null ? user.getFullName() : null;
            String spec = coach.getSpecialization();
            String bio = coach.getBio();
            if (!containsRetiredSport(spec) && !containsRetiredSport(bio)) {
                continue;
            }
            if (LONG_EMAIL.equalsIgnoreCase(email) || LONG_NAME.equalsIgnoreCase(fullName)) {
                coach.setSpecialization("Boxing");
                if (containsRetiredSport(bio)) {
                    coach.setBio(LONG_BIO);
                }
                coaches.save(coach);
                updated++;
            } else if (THAO_EMAIL.equalsIgnoreCase(email) || THAO_NAME.equalsIgnoreCase(fullName)) {
                coach.setSpecialization("Yoga & Phục hồi");
                if ("ASCA Level 2".equalsIgnoreCase(coach.getCertification())) {
                    coach.setCertification("RYT-200");
                }
                if (containsRetiredSport(bio)) {
                    coach.setBio(THAO_BIO);
                }
                coaches.save(coach);
                updated++;
            }
        }
        if (updated > 0) {
            log.info("Retired catalog cleanup: updated {} demo coach profiles.", updated);
        }
    }

    private static final java.util.regex.Pattern RETIRED_SPORT_PATTERN =
            java.util.regex.Pattern.compile("(?iu)(^|[^\\p{L}])(tennis|bơi|cầu lông|swimming|badminton|aquatics?)([^\\p{L}]|$)");

    /** Kiểm tra chuỗi có chứa tên một bộ môn đã ngừng không (Tennis, Bơi/Bơi lội, Cầu lông). */
    public static boolean containsRetiredSport(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return RETIRED_SPORT_PATTERN.matcher(text).find();
    }

    private boolean isRetiredClass(GymClass gymClass) {
        if (gymClass == null) {
            return false;
        }
        if (gymClass.getName() != null && RETIRED_DEMO_CLASSES.contains(normalize(gymClass.getName()))) {
            return true;
        }
        Discipline discipline = gymClass.getDiscipline();
        return discipline != null && discipline.getName() != null
                && RETIRED_DISCIPLINES.contains(normalize(discipline.getName()));
    }

    private boolean hasClassDependents(Long classId) {
        if (classId == null) {
            return false;
        }
        if (enrollments != null && !safeList(enrollments.findByGymClassId(classId)).isEmpty()) {
            return true;
        }
        if (sessionBookings != null && sessionBookings.existsBySessionGymClassId(classId)) {
            return true;
        }
        if (trainingPlans != null && trainingPlans.existsByGymClassId(classId)) {
            return true;
        }
        if (sessionAttendances != null && sessionAttendances.existsBySessionGymClassId(classId)) {
            return true;
        }
        if (sessionEvaluations != null && sessionEvaluations.existsBySessionGymClassId(classId)) {
            return true;
        }
        if (coachReviews != null && sessions != null) {
            for (ClassSession session : safeList(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId))) {
                if (session != null && session.getId() != null && coachReviews.existsByClassSessionId(session.getId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean legacyCourtBookingsTableExists() {
        if (jdbcTemplate == null) {
            return false;
        }
        try {
            Boolean exists = jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'court_bookings')",
                    Boolean.class);
            return Boolean.TRUE.equals(exists);
        } catch (RuntimeException ex) {
            log.debug("Skipping legacy court_bookings table check: {}", ex.getMessage());
            return false;
        }
    }

    private boolean hasLegacyCourtBookingsForRoom(Long roomId) {
        if (jdbcTemplate == null || roomId == null) {
            return false;
        }
        try {
            Boolean exists = jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM court_bookings WHERE room_id = ?)",
                    Boolean.class, roomId);
            return Boolean.TRUE.equals(exists);
        } catch (RuntimeException ex) {
            log.debug("Legacy court_bookings lookup failed for room {}: {}", roomId, ex.getMessage());
            return true; // An toàn: coi như đang được tham chiếu để chuyển phòng sang closed thay vì gây lỗi FK.
        }
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static <T> List<T> safeList(List<T> items) {
        return items == null ? List.of() : items;
    }
}
