package com.swp391.scms.demo;

import com.swp391.scms.coaching.repository.CoachBookingRepository;
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
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tạo thêm thời khóa biểu lớp nhóm mẫu (đang diễn ra, sắp mở, đã kết thúc) để trung tâm trông đông đúc khi
 * demo. Chỉ chạy khi bật cả app.demo.seed-enabled và app.legacy.classes-enabled; mỗi tên lớp chỉ tạo một lần.
 * Mỗi lớp chỉ được xếp vào khung giờ HLV và phòng còn trống (tránh trigger trùng lịch từ chối); không xếp được
 * thì bỏ qua và ghi cảnh báo.
 *
 * Thời khóa biểu bổ sung tùy chọn để trung tâm trông đông đúc: hàng chục khóa học định kỳ (đang diễn ra, sắp
 * tới và đã kết thúc) như thể quản lý đã tạo. Bật cùng {@link DemoDataSeeder}.
 * ({@code app.demo.seed-enabled}) but independent of it: it can top up a database that was demo-seeded before, and it is
 * Idempotent theo tên lớp: lớp đã tồn tại thì không bao giờ bị tạo trùng hay sửa đổi.
 *
 * <p>The database triggers reject a session that overlaps another session of the same coach or room, or a confirmed PT
 * Đặt chỗ của cùng HLV, nên mỗi khóa chỉ được xếp vào khung trống (kiểm tra với các buổi và lượt đặt PT đã
 * xác nhận đang lưu); khóa không xếp được sẽ bị bỏ qua kèm cảnh báo. HLV lấy từ nhân viên đang hoạt động theo
 * chuyên môn, phòng theo tên, và không tạo hội viên hay ghi danh nào.
 */
@Component
@Order(210)
@ConditionalOnProperty(name = {"app.demo.seed-enabled", "app.legacy.classes-enabled"}, havingValue = "true")
public class DemoClassSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoClassSeeder.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalTime OPENING = LocalTime.of(6, 0);
    private static final LocalTime CLOSING = LocalTime.of(22, 0);
    /** Các số phút lần lượt được thử khi giờ bắt đầu ưa thích đã bị HLV hoặc phòng chiếm. */
    private static final int[] SHIFTS = {0, 60, 120, 180, 240, -60, -120};

    /**
     * Mô tả một khóa học mẫu: tên, bộ môn, phòng, trình độ, sức chứa, học phí, các thứ trong tuần, giờ bắt đầu,
     * thời lượng, khoảng ngày (tính từ hôm nay, âm là quá khứ), trạng thái và mô tả.
     *
     * Một khóa học. {@code fromDay}/{@code toDay} giới hạn các buổi so với ngày seed (âm = quá khứ); ngày của
     * lớp theo buổi đầu và buổi cuối.
     */
    record ClassSpec(String name, String discipline, String room, String level, int capacity, int price, String days,
                     String start, int minutes, int fromDay, int toDay, String status, String description) {

        /** Đổi chuỗi các thứ (ví dụ "MON,WED") thành tập ngày trong tuần. */
        Set<DayOfWeek> dayOfWeeks() {
            Set<DayOfWeek> result = EnumSet.noneOf(DayOfWeek.class);
            for (String token : days.split(",")) {
                for (DayOfWeek day : DayOfWeek.values()) {
                    if (day.name().startsWith(token.trim().toUpperCase(Locale.ROOT))) {
                        result.add(day);
                    }
                }
            }
            return result;
        }
    }

    private static final String GYM = "Phòng Gym Tiêu chuẩn";
    private static final String VIP = "Phòng Gym VIP";
    private static final String ZEN = "Zen Garden Studio";
    private static final String POOL = "Oasis Lap Pool";

    /** Tạo mô tả khóa đang diễn ra (bắt đầu 21 ngày trước, kết thúc sau 35 ngày). */
    private static ClassSpec ongoing(String name, String discipline, String room, String level, int capacity,
                                     int price, String days, String start, int minutes, String description) {
        return new ClassSpec(name, discipline, room, level, capacity, price, days, start, minutes, -21, 35, "active",
                description);
    }

    /** Tạo mô tả khóa sắp mở, bắt đầu sau startsIn ngày và kéo dài 6 tuần. */
    private static ClassSpec upcoming(String name, String discipline, String room, String level, int capacity,
                                      int price, String days, String start, int minutes, int startsIn,
                                      String description) {
        return new ClassSpec(name, discipline, room, level, capacity, price, days, start, minutes, startsIn,
                startsIn + 42, "active", description);
    }

    /** Tạo mô tả khóa đã kết thúc endedDaysAgo ngày trước, đã lưu trữ. */
    private static ClassSpec finished(String name, String discipline, String room, String level, int capacity,
                                      int price, String days, String start, int minutes, int endedDaysAgo,
                                      String description) {
        return new ClassSpec(name, discipline, room, level, capacity, price, days, start, minutes, -endedDaysAgo - 42,
                -endedDaysAgo, "archived", description);
    }

    static final List<ClassSpec> CLASSES = List.of(
            // Gym
            ongoing("Full Body Strength 101", "Gym", GYM, "beginner", 20, 0, "MON,WED,FRI", "06:30", 60,
                    "Nền tảng tập tạ toàn thân cho người mới: tư thế, hơi thở và giáo án tuần."),
            ongoing("HIIT Fat Burn", "Gym", GYM, "all", 24, 0, "MON,WED,FRI", "18:30", 60,
                    "Giãn cách cường độ cao, đốt mỡ nhanh, phù hợp mọi trình độ."),
            ongoing("Hypertrophy Upper/Lower", "Gym", GYM, "intermediate", 16, 350000, "TUE,THU,SAT", "17:30", 75,
                    "Chia buổi thân trên/thân dưới để tăng cơ, có chấm điểm kỹ thuật theo tuần."),
            ongoing("Powerlifting Technique", "Gym", VIP, "advanced", 10, 600000, "TUE,THU", "19:30", 90,
                    "Squat, bench, deadlift chuẩn kỹ thuật với huấn luyện viên kèm sát."),
            ongoing("Core & Mobility", "Gym", GYM, "all", 20, 0, "SAT", "08:00", 60,
                    "Core, linh hoạt khớp và phục hồi cuối tuần."),
            upcoming("Morning Circuit Training", "Gym", GYM, "all", 25, 0, "TUE,THU", "06:00", 60, 5,
                    "Tập vòng tuần hoàn buổi sáng giúp khởi động ngày mới."),
            upcoming("Glute & Lower Body", "Gym", GYM, "beginner", 18, 450000, "MON,WED", "20:00", 60, 9,
                    "Tập chuyên sâu thân dưới và mông, tăng dần mức tạ."),
            upcoming("Kettlebell Conditioning", "Gym", GYM, "intermediate", 15, 0, "SUN", "09:00", 75, 12,
                    "Chuông tạ kết hợp thể lực, cải thiện sức mạnh toàn thân."),
            finished("Summer Shred 6 Tuần", "Gym", GYM, "all", 22, 300000, "MON,WED,FRI", "19:30", 60, 10,
                    "Khóa giảm mỡ 6 tuần đã hoàn thành, kết quả được lưu lại để tham khảo."),
            // Yoga
            ongoing("Hatha Yoga Nền Tảng", "Yoga", ZEN, "beginner", 15, 0, "MON,WED,FRI", "06:30", 60,
                    "Các tư thế Hatha cơ bản, thở sâu và giãn cơ nhẹ nhàng."),
            ongoing("Vinyasa Flow", "Yoga", ZEN, "intermediate", 14, 250000, "TUE,THU", "18:30", 75,
                    "Chuỗi chuyển động liên tục theo nhịp thở, tăng sức bền và thăng bằng."),
            ongoing("Yoga Trị Liệu Lưng Cổ", "Yoga", ZEN, "all", 12, 0, "WED,FRI", "12:00", 60,
                    "Bài tập giãn cơ vùng lưng - cổ - vai cho người ngồi văn phòng."),
            ongoing("Yin Yoga Thư Giãn", "Yoga", ZEN, "all", 16, 0, "SUN", "17:00", 75,
                    "Giữ tư thế lâu để giải tỏa căng thẳng, ngủ ngon hơn."),
            upcoming("Power Yoga", "Yoga", ZEN, "advanced", 12, 300000, "SAT", "07:00", 90, 6,
                    "Yoga cường độ cao kết hợp sức mạnh và thăng bằng."),
            upcoming("Meditation & Breathwork", "Yoga", ZEN, "all", 18, 0, "SUN", "07:00", 60, 13,
                    "Thiền và kiểm soát hơi thở để giảm stress."),
            finished("Yoga Chào Hè", "Yoga", ZEN, "beginner", 15, 0, "MON,WED", "07:30", 60, 20,
                    "Khóa Yoga khởi động mùa hè đã kết thúc."),
            // Boxing
            ongoing("Boxing Cơ Bản", "Boxing", VIP, "beginner", 14, 0, "TUE,THU", "19:00", 75,
                    "Tư thế, đòn thẳng, móc và di chuyển chân cơ bản."),
            ongoing("Kickfit Cardio", "Boxing", VIP, "all", 20, 0, "MON,WED", "19:00", 60,
                    "Boxing aerobic cường độ vừa, đốt năng lượng và thư giãn."),
            ongoing("Boxing Sparring Kỹ Thuật", "Boxing", VIP, "advanced", 10, 500000, "FRI", "19:30", 90,
                    "Tập đối kháng có kiểm soát với bảo hộ đầy đủ."),
            upcoming("Boxing Bootcamp Sáng", "Boxing", VIP, "intermediate", 16, 0, "SAT,SUN", "07:30", 75, 8,
                    "Bootcamp cuối tuần: bao cát, mitt và thể lực theo hiệp."),
            finished("Boxing Bootcamp 4 Tuần", "Boxing", VIP, "intermediate", 14, 400000, "MON,WED", "20:15", 60, 14,
                    "Khóa bootcamp 4 tuần đã hoàn thành."),
            // Bơi lội
            ongoing("Bơi Cơ Bản Người Lớn", "Bơi lội", POOL, "beginner", 10, 0, "MON,WED", "06:00", 60,
                    "Làm quen với nước, thở và kỹ thuật bơi ếch/sải cơ bản."),
            ongoing("Bơi Sải Kỹ Thuật", "Bơi lội", POOL, "intermediate", 8, 350000, "TUE,THU", "18:00", 60,
                    "Chỉnh sửa động tác sải, nhịp thở và đạp chân."),
            ongoing("Aqua Fitness", "Bơi lội", POOL, "all", 16, 0, "SAT", "07:30", 60,
                    "Bài tập sức bền dưới nước, ít chấn thương khớp."),
            upcoming("Bơi Sức Bền Nâng Cao", "Bơi lội", POOL, "advanced", 8, 450000, "FRI", "06:00", 75, 10,
                    "Giáo án cự ly dài, nâng ngưỡng sức bền."),
            finished("Bơi Trẻ Hóa Sau Làm Việc", "Bơi lội", POOL, "all", 12, 0, "TUE,THU", "19:30", 60, 25,
                    "Khóa bơi thư giãn buổi tối đã hoàn thành."));

    /** Một khung giờ đã bận (giờ bắt đầu, giờ kết thúc). */
    private record Slot(LocalTime start, LocalTime end) {
        /** Hai khung giờ có giao nhau không. */
        boolean overlaps(LocalTime otherStart, LocalTime otherEnd) {
            return otherStart.isBefore(end) && otherEnd.isAfter(start);
        }
    }

    private final GymClassRepository classes;
    private final ClassSessionRepository sessions;
    private final CoachRepository coaches;
    private final RoomRepository rooms;
    private final DisciplineRepository disciplines;
    private final UserRepository users;
    private final CoachBookingRepository coachBookings;

    /** Nhận các repository cần thiết để tạo lớp, buổi học và kiểm tra lịch bận. */
    public DemoClassSeeder(GymClassRepository classes, ClassSessionRepository sessions, CoachRepository coaches,
                           RoomRepository rooms, DisciplineRepository disciplines, UserRepository users,
                           CoachBookingRepository coachBookings) {
        this.classes = classes;
        this.sessions = sessions;
        this.coaches = coaches;
        this.rooms = rooms;
        this.disciplines = disciplines;
        this.users = users;
        this.coachBookings = coachBookings;
    }

    /**
     * Lấy HLV đang làm việc, phòng sẵn sàng, bộ môn và tên các lớp đã có; ghi lại mọi khung đã bận (buổi lớp,
     * buổi PT đã xác nhận) trong ±150 ngày; với từng lớp mẫu chưa có thì tìm HLV và giờ trống rồi lưu lớp cùng
     * các buổi học, cập nhật lịch bận. Cuối cùng ghi log số lớp đã tạo/bỏ qua.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Coach> activeCoaches = coaches.findActiveWithUser();
        if (activeCoaches.isEmpty()) {
            log.info("Demo class seed skipped: no active coach yet.");
            return;
        }
        LocalDate today = LocalDate.now(ZONE);
        LocalDateTime now = LocalDateTime.now(ZONE);
        User manager = findManager();

        Map<String, Room> roomByName = new HashMap<>();
        rooms.findAllByOrderByNameAsc().stream()
                .filter(r -> "available".equalsIgnoreCase(r.getStatus()))
                .forEach(r -> roomByName.put(r.getName(), r));
        Map<String, Discipline> disciplineByName = new HashMap<>();
        disciplines.findAll().forEach(d -> disciplineByName.put(d.getName(), d));
        Set<String> existingNames = new HashSet<>();
        classes.findAll().forEach(c -> existingNames.add(c.getName()));

        // Các khung mà trigger database sẽ từ chối: mọi buổi chưa hủy theo HLV và theo phòng, và mọi lượt đặt
        // PT đã xác nhận của HLV (trg_sessions_check_conflict trong scms_guard_pt_schedule), theo từng ngày.
        Map<String, List<Slot>> busy = new HashMap<>();
        coachBookings.findConfirmedBetween(today.minusDays(150), today.plusDays(150)).forEach(b ->
                reserve(busy, "coach", b.getCoach().getUserId(), b.getBookingDate(), b.getStartTime(), b.getEndTime()));
        sessions.findNotCancelledBetween(today.minusDays(150), today.plusDays(150)).forEach(s -> {
            GymClass owner = s.getGymClass();
            if (owner.getCoach() != null) {
                reserve(busy, "coach", owner.getCoach().getUserId(), s.getSessionDate(), s.getStartTime(), s.getEndTime());
            }
            if (owner.getRoom() != null) {
                reserve(busy, "room", owner.getRoom().getId(), s.getSessionDate(), s.getStartTime(), s.getEndTime());
            }
        });

        int created = 0;
        int skipped = 0;
        int turn = 0;
        for (ClassSpec spec : CLASSES) {
            if (existingNames.contains(spec.name())) {
                continue;
            }
            Room room = roomByName.get(spec.room());
            Discipline discipline = disciplineByName.get(spec.discipline());
            if (room == null || discipline == null) {
                log.warn("Demo class seed: skip '{}' (room '{}' unavailable or discipline '{}' missing)",
                        spec.name(), spec.room(), spec.discipline());
                skipped++;
                continue;
            }
            List<LocalDate> dates = datesOf(spec, today);
            if (dates.isEmpty()) {
                skipped++;
                continue;
            }
            Placement placement = place(spec, room, dates, candidateCoaches(activeCoaches, spec.discipline(), turn++),
                    busy);
            if (placement == null) {
                log.warn("Demo class seed: skip '{}' (no free coach/room slot)", spec.name());
                skipped++;
                continue;
            }
            save(spec, discipline, room, placement, dates, manager, now);
            for (LocalDate date : dates) {
                reserve(busy, "coach", placement.coach().getUserId(), date, placement.start(), placement.end());
                reserve(busy, "room", room.getId(), date, placement.start(), placement.end());
            }
            created++;
        }
        log.info("Demo class seed: {} classes created, {} skipped (already present or no free slot).", created, skipped);
    }

    /** Kết quả xếp lớp: HLV, giờ bắt đầu và giờ kết thúc. */
    private record Placement(Coach coach, LocalTime start, LocalTime end) {}

    /**
     * Tìm cặp (HLV, giờ bắt đầu) đầu tiên còn trống ở mọi ngày học: thử giờ ưu tiên rồi lệch dần theo SHIFTS,
     * trong giờ mở cửa 06:00-22:00; không có thì trả null.
     *
     * (HLV, giờ bắt đầu) đầu tiên rảnh ở mọi ngày học; null khi không có cái nào phù hợp.
     */
    private Placement place(ClassSpec spec, Room room, List<LocalDate> dates, List<Coach> candidates,
                            Map<String, List<Slot>> busy) {
        LocalTime preferred = LocalTime.parse(spec.start());
        for (Coach coach : candidates) {
            for (int shift : SHIFTS) {
                LocalTime start = preferred.plusMinutes(shift);
                LocalTime end = start.plusMinutes(spec.minutes());
                if (start.isBefore(OPENING) || end.isAfter(CLOSING) || !end.isAfter(start)) {
                    continue;
                }
                boolean free = dates.stream().noneMatch(d ->
                        isBusy(busy, "coach", coach.getUserId(), d, start, end)
                                || isBusy(busy, "room", room.getId(), d, start, end));
                if (free) {
                    return new Placement(coach, start, end);
                }
            }
        }
        return null;
    }

    /**
     * Danh sách HLV ứng viên: HLV đúng chuyên môn đứng trước (xoay vòng để chia đều), HLV khác chỉ dùng khi bất
     * đắc dĩ.
     *
     * Ưu tiên HLV của bộ môn (xoay vòng để dàn đều tải); HLV đang hoạt động khác chỉ dùng như phương án cuối.
     */
    private static List<Coach> candidateCoaches(List<Coach> all, String discipline, int turn) {
        String key = discipline.toLowerCase(Locale.ROOT);
        List<Coach> matching = new ArrayList<>(all.stream()
                .filter(c -> c.getSpecialization() != null
                        && c.getSpecialization().toLowerCase(Locale.ROOT).contains(key))
                .toList());
        List<Coach> result = new ArrayList<>();
        for (int i = 0; i < matching.size(); i++) {
            result.add(matching.get((turn + i) % matching.size()));
        }
        all.stream().filter(c -> !matching.contains(c)).forEach(result::add);
        return result;
    }

    /** Các ngày học của khóa: những ngày trong khoảng đã định rơi vào đúng các thứ trong tuần. */
    private static List<LocalDate> datesOf(ClassSpec spec, LocalDate today) {
        Set<DayOfWeek> days = spec.dayOfWeeks();
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = today.plusDays(spec.fromDay()); !d.isAfter(today.plusDays(spec.toDay())); d = d.plusDays(1)) {
            if (days.contains(d.getDayOfWeek())) {
                dates.add(d);
            }
        }
        return dates;
    }

    /**
     * Lưu lớp (sức chứa không vượt sức chứa phòng, ngày tạo giả lập 14 ngày trước buổi đầu) và tạo từng buổi
     * học; buổi đã qua đánh dấu completed, còn lại scheduled.
     */
    private void save(ClassSpec spec, Discipline discipline, Room room, Placement placement, List<LocalDate> dates,
                      User manager, LocalDateTime now) {
        GymClass gymClass = new GymClass();
        gymClass.setName(spec.name());
        gymClass.setDiscipline(discipline);
        gymClass.setCoach(placement.coach());
        gymClass.setRoom(room);
        gymClass.setCapacity(Math.min(spec.capacity(), room.getCapacity()));
        gymClass.setLevel(spec.level());
        gymClass.setDescription(spec.description());
        gymClass.setStatus(spec.status());
        gymClass.setPrice(BigDecimal.valueOf(spec.price()));
        gymClass.setStartDate(dates.get(0));
        gymClass.setEndDate(dates.get(dates.size() - 1));
        gymClass.setRecurringDays(String.join(",", spec.dayOfWeeks().stream().map(DayOfWeek::name).toList()));
        gymClass.setStartTime(placement.start());
        gymClass.setEndTime(placement.end());
        gymClass.setCreatedBy(manager);
        LocalDateTime announced = dates.get(0).minusDays(14).atTime(9, 0);
        gymClass.setCreatedAt(announced.isAfter(now) ? now : announced);
        gymClass = classes.save(gymClass);

        for (LocalDate date : dates) {
            ClassSession session = new ClassSession();
            session.setGymClass(gymClass);
            session.setSessionDate(date);
            session.setStartTime(placement.start());
            session.setEndTime(placement.end());
            session.setStatus(date.atTime(placement.end()).isBefore(now) ? "completed" : "scheduled");
            sessions.save(session);
        }
    }

    /** Quản lý tạo lớp: ưu tiên tài khoản quản lý demo, không có thì lấy quản lý đầu tiên. */
    private User findManager() {
        List<User> managers = users.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(List.of("CENTER_MANAGER"));
        return managers.stream().filter(u -> DemoDataSeeder.MANAGER_EMAIL.equalsIgnoreCase(u.getEmail())).findFirst()
                .orElse(managers.isEmpty() ? null : managers.get(0));
    }

    /** Khóa tra cứu lịch bận theo loại (coach/room), id và ngày. */
    private static String key(String kind, Long id, LocalDate date) {
        return kind + ":" + id + ":" + date;
    }

    /** Ghi một khung giờ bận của HLV hoặc phòng vào ngày cho trước. */
    private static void reserve(Map<String, List<Slot>> busy, String kind, Long id, LocalDate date, LocalTime start,
                                LocalTime end) {
        busy.computeIfAbsent(key(kind, id, date), k -> new ArrayList<>()).add(new Slot(start, end));
    }

    /** HLV/phòng có bận trong khung giờ đó vào ngày cho trước không. */
    private static boolean isBusy(Map<String, List<Slot>> busy, String kind, Long id, LocalDate date, LocalTime start,
                                  LocalTime end) {
        return busy.getOrDefault(key(kind, id, date), List.of()).stream().anyMatch(s -> s.overlaps(start, end));
    }
}
