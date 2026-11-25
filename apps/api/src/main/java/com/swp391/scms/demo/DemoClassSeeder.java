package com.swp391.scms.demo;

import com.swp391.scms.coaching.repository.CoachBookingRepository;
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
 * Tạo thêm thời khóa biểu lớp nhóm mẫu (đang diễn ra, sắp mở, đã kết thúc) để trung tâm trông đông đúc như thể
 * quản lý đã tạo. Bật cùng {@link DemoDataSeeder} ({@code app.demo.seed-enabled}) và cờ
 * {@code app.legacy.classes-enabled} nhưng hoạt động độc lập: có thể bổ sung vào database đã seed demo trước đó
 * và mang tính idempotent theo tên lớp (lớp đã tồn tại sẽ không bao giờ bị tạo trùng hay sửa đổi).
 *
 * <p>Trigger database sẽ từ chối buổi học trùng giờ với buổi khác của cùng HLV hoặc phòng, hoặc trùng với lượt
 * đặt PT đã xác nhận của cùng HLV, nên mỗi khóa chỉ được xếp vào khung trống (kiểm tra với các buổi và lượt đặt
 * PT đã xác nhận đang lưu); khóa không xếp được sẽ bị bỏ qua kèm cảnh báo. HLV lấy từ nhân viên đang hoạt động
 * theo chuyên môn, phòng lấy theo tên, và không tạo hội viên hay ghi danh nào.
 */
@Component
@Order(210)
@ConditionalOnProperty(name = {"app.demo.seed-enabled", "app.legacy.classes-enabled"}, havingValue = "true")
public class DemoClassSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoClassSeeder.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Mô tả một khóa học mẫu: tên, bộ môn, phòng, trình độ, sức chứa, học phí, các thứ trong tuần, slot cố định,
     * khoảng ngày (tính từ hôm nay, âm là quá khứ), trạng thái và mô tả.
     *
     * Một khóa học. {@code fromDay}/{@code toDay} giới hạn các buổi so với ngày seed (âm = quá khứ); ngày của
     * lớp theo buổi đầu và buổi cuối.
     */
    record ClassSpec(String name, String discipline, String room, String level, int capacity, int price, String days,
                     ScheduleSlot slot, int fromDay, int toDay, String status, String description) {

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
    private static final String RING = "Ring Arena 01";
    private static final String ZEN = "Zen Garden Studio";

    /** Tạo mô tả khóa đang diễn ra (bắt đầu 14 ngày trước, kết thúc sau 42 ngày). */
    private static ClassSpec ongoing(String name, String discipline, String room, String level, int capacity,
                                     int price, String days, ScheduleSlot slot, String description) {
        return new ClassSpec(name, discipline, room, level, capacity, price, days, slot, -14, 42, "active",
                description);
    }

    /** Tạo mô tả khóa sắp khai giảng (bắt đầu sau 7 ngày, kết thúc sau 49 ngày) để hội viên có thể đăng ký ngay. */
    private static ClassSpec upcoming(String name, String discipline, String room, String level, int capacity,
                                      int price, String days, ScheduleSlot slot, String description) {
        return new ClassSpec(name, discipline, room, level, capacity, price, days, slot, 7, 49, "active",
                description);
    }

    /**
     * Các lớp đang hoạt động ({@code active}) cho 3 bộ môn chuẩn (Gym, Yoga, Boxing) dùng 5 slot cố định
     * (07:00–19:30): mỗi bộ môn gồm 1 khóa đang diễn ra và 1 khóa sắp khai giảng ({@code fromDay > 0}) không trùng
     * ngày & slot cùng bộ môn, tuân thủ quy tắc đa lớp/bộ môn.
     */
    static final List<ClassSpec> CLASSES = List.of(
            ongoing("Full Body Strength 101", "Gym", GYM, "all", 20, 0, "MON,WED,FRI", ScheduleSlot.SLOT_1,
                    "Nền tảng tập tạ toàn thân cho mọi trình độ: tư thế, hơi thở và giáo án tuần."),
            ongoing("Hatha Yoga Nền Tảng", "Yoga", ZEN, "all", 16, 0, "MON,WED,FRI", ScheduleSlot.SLOT_2,
                    "Các tư thế Hatha cơ bản, hít thở sâu, thăng bằng và giãn cơ."),
            ongoing("Boxing Cơ Bản", "Boxing", RING, "all", 14, 0, "TUE,THU,SAT", ScheduleSlot.SLOT_5,
                    "Tư thế, đòn thẳng, móc, di chuyển chân và thể lực theo hiệp."),
            upcoming("Hypertrophy & Conditioning Khóa Mới", "Gym", GYM, "intermediate", 20, 450000, "TUE,THU,SAT",
                    ScheduleSlot.SLOT_1,
                    "Khóa tăng cơ và sức bền khai giảng sắp tới, giáo án phân chia nhóm cơ khoa học."),
            upcoming("Vinyasa Flow & Phục Hồi", "Yoga", ZEN, "all", 16, 400000, "TUE,THU,SAT", ScheduleSlot.SLOT_2,
                    "Chuỗi Vinyasa liền mạch kết hợp giãn cơ phục hồi cho mọi trình độ."),
            upcoming("Boxing Thể Lực & Phản Xạ", "Boxing", RING, "intermediate", 14, 500000, "MON,WED,FRI",
                    ScheduleSlot.SLOT_5,
                    "Nâng cao tốc độ ra đòn, né tránh, đánh bao cát và thể lực chuyên sâu."));

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

        // Các khung mà trigger database sẽ từ chối: mọi buổi chưa hủy theo HLV, theo phòng, theo bộ môn (lớp active),
        // và mọi lượt đặt PT đã xác nhận của HLV (trg_sessions_check_conflict & trg_pt_schedule_booking), theo từng ngày.
        Map<String, List<Slot>> busy = new HashMap<>();
        coachBookings.findConfirmedBetween(today.minusDays(150), today.plusDays(150)).forEach(b ->
                reserve(busy, "coach", b.getCoach().getUserId(), b.getBookingDate(), b.getStartTime(), b.getEndTime()));
        sessions.findNotCancelledBetween(today.minusDays(150), today.plusDays(150)).forEach(s -> {
            GymClass owner = s.getGymClass();
            if (owner == null) {
                return;
            }
            if (owner.getCoach() != null) {
                reserve(busy, "coach", owner.getCoach().getUserId(), s.getSessionDate(), s.getStartTime(), s.getEndTime());
            }
            if (owner.getRoom() != null) {
                reserve(busy, "room", owner.getRoom().getId(), s.getSessionDate(), s.getStartTime(), s.getEndTime());
            }
            if ("active".equalsIgnoreCase(owner.getStatus())
                    && owner.getDiscipline() != null && owner.getDiscipline().getId() != null) {
                reserve(busy, "discipline", owner.getDiscipline().getId(),
                        s.getSessionDate(), s.getStartTime(), s.getEndTime());
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
            Placement placement = place(spec, discipline, room, dates,
                    candidateCoaches(activeCoaches, spec.discipline(), turn++), busy);
            if (placement == null) {
                log.warn("Demo class seed: skip '{}' (no free coach/room/discipline slot)", spec.name());
                skipped++;
                continue;
            }
            save(spec, discipline, room, placement, dates, manager, now);
            for (LocalDate date : dates) {
                reserve(busy, "coach", placement.coach().getUserId(), date, placement.start(), placement.end());
                reserve(busy, "room", room.getId(), date, placement.start(), placement.end());
                if ("active".equalsIgnoreCase(spec.status()) && discipline.getId() != null) {
                    reserve(busy, "discipline", discipline.getId(), date, placement.start(), placement.end());
                }
            }
            created++;
        }
        log.info("Demo class seed: {} classes created, {} skipped (already present or no free slot).", created, skipped);
    }

    /** Kết quả xếp lớp: HLV, giờ bắt đầu và giờ kết thúc. */
    private record Placement(Coach coach, LocalTime start, LocalTime end) {}

    /**
     * Tìm cặp (HLV, slot cố định) đầu tiên còn trống ở mọi ngày học (không trùng HLV, phòng và bộ môn của lớp
     * active): thử slot ưu tiên trước rồi lần lượt các slot còn lại trong 5 {@link ScheduleSlot}; không có thì trả
     * null.
     */
    private Placement place(ClassSpec spec, Discipline discipline, Room room, List<LocalDate> dates,
                            List<Coach> candidates, Map<String, List<Slot>> busy) {
        List<ScheduleSlot> orderedSlots = new ArrayList<>();
        orderedSlots.add(spec.slot());
        for (ScheduleSlot candidate : ScheduleSlot.values()) {
            if (candidate != spec.slot()) {
                orderedSlots.add(candidate);
            }
        }
        boolean checkDiscipline = "active".equalsIgnoreCase(spec.status())
                && discipline != null && discipline.getId() != null;
        for (Coach coach : candidates) {
            for (ScheduleSlot candidateSlot : orderedSlots) {
                LocalTime start = candidateSlot.startTime();
                LocalTime end = candidateSlot.endTime();
                boolean free = dates.stream().noneMatch(d ->
                        isBusy(busy, "coach", coach.getUserId(), d, start, end)
                                || isBusy(busy, "room", room.getId(), d, start, end)
                                || (checkDiscipline && isBusy(busy, "discipline", discipline.getId(), d, start, end)));
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
