package com.swp391.scms.facilities;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chạy một lần duy nhất (idempotent) khi khởi động trước {@code DemoDataSeeder} (@Order 200) và
 * {@code DemoClassSeeder} (@Order 210) để dọn sạch dữ liệu lịch đang hoạt động/sắp diễn ra không khớp 5 slot cố
 * định (07:00–20:30). Trước khi dọn, dời giờ dữ liệu theo bộ 5 slot cũ (07:00–19:30) sang slot mới cùng số để
 * giữ lớp, đăng ký và lịch PT.
 *
 * <p>Chỉ kiểm tra lớp {@code active} có đầy đủ giờ học, buổi lớp {@code scheduled} từ hôm nay trở đi và buổi PT
 * {@code confirmed} từ hôm nay trở đi; không bao giờ xóa dữ liệu chỉ vì {@code classes.start_time/end_time} là
 * {@code NULL} hoặc vì bản ghi lịch sử/đã đóng. Có thể tắt hoàn toàn bằng
 * {@code app.scheduling.legacy-slot-reset-enabled=false}.
 */
@Component
@Order(195)
public class LegacyScheduleSlotResetRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyScheduleSlotResetRunner.class);

    private static final String TABLE_EXISTS_SQL =
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    + "WHERE table_schema = current_schema() AND table_name = ?)";

    private static final String CANONICAL_FIVE_SLOTS_EXPR =
            "(start_time = TIME '07:00:00' AND end_time = TIME '09:30:00') "
                    + "OR (start_time = TIME '09:45:00' AND end_time = TIME '12:15:00') "
                    + "OR (start_time = TIME '12:30:00' AND end_time = TIME '15:00:00') "
                    + "OR (start_time = TIME '15:15:00' AND end_time = TIME '17:45:00') "
                    + "OR (start_time = TIME '18:00:00' AND end_time = TIME '20:30:00')";

    /** Slot 2–5 của bộ cũ {cũ bắt đầu, cũ kết thúc, mới bắt đầu, mới kết thúc}; dời từ Slot 5 xuống để không tạm chồng lên slot chưa dời. */
    static final List<String[]> PREVIOUS_SLOT_SHIFTS = List.of(
            new String[] {"17:00", "19:30", "18:00", "20:30"},
            new String[] {"14:15", "16:45", "15:15", "17:45"},
            new String[] {"11:30", "14:00", "12:30", "15:00"},
            new String[] {"09:45", "11:15", "09:45", "12:15"});

    private static final String CENTER_TODAY_SQL =
            "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

    private static final String CLASSES_LEGACY_CONDITION =
            "status = 'active' AND start_time IS NOT NULL AND end_time IS NOT NULL AND NOT ("
                    + CANONICAL_FIVE_SLOTS_EXPR + ")";

    private static final String CLASS_SESSIONS_LEGACY_CONDITION =
            "status = 'scheduled' AND session_date >= " + CENTER_TODAY_SQL
                    + " AND NOT (" + CANONICAL_FIVE_SLOTS_EXPR + ")";

    private static final String COACH_BOOKINGS_LEGACY_CONDITION =
            "status = 'confirmed' AND booking_date >= " + CENTER_TODAY_SQL
                    + " AND NOT (" + CANONICAL_FIVE_SLOTS_EXPR + ")";

    private record TableCheck(String tableName, String condition) {
    }

    private static final List<TableCheck> SCHEDULE_SOURCE_CHECKS = List.of(
            new TableCheck("classes", CLASSES_LEGACY_CONDITION),
            new TableCheck("class_sessions", CLASS_SESSIONS_LEGACY_CONDITION),
            new TableCheck("coach_bookings", COACH_BOOKINGS_LEGACY_CONDITION)
    );

    private static final List<String> TABLES_TO_DELETE_IN_ORDER = List.of(
            "session_attendance",
            "session_evaluations",
            "coach_reviews",
            "session_bookings",
            "class_enrollments",
            "class_waitlists",
            "class_sessions",
            "classes",
            "coach_bookings"
    );

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;

    /** Constructor cho test: mặc định bật kiểm tra reset lịch lệch slot. */
    public LegacyScheduleSlotResetRunner(JdbcTemplate jdbcTemplate) {
        this(jdbcTemplate, true);
    }

    /** Nhận JdbcTemplate tùy chọn và cờ bật/tắt (có thể tắt trong production qua cấu hình). */
    @Autowired
    public LegacyScheduleSlotResetRunner(
            @Autowired(required = false) JdbcTemplate jdbcTemplate,
            @Value("${app.scheduling.legacy-slot-reset-enabled:true}") boolean enabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.debug("Legacy schedule slot reset skipped: disabled by configuration.");
            return;
        }
        if (jdbcTemplate == null) {
            log.debug("Legacy schedule slot reset skipped: JdbcTemplate unavailable.");
            return;
        }
        if (!shiftPreviousSlotRows()) {
            return;
        }
        if (!hasAnyLegacyScheduleRows()) {
            log.debug("Legacy schedule slot reset skipped: no non-canonical schedule rows found.");
            return;
        }

        int unlinkedPayments = 0;
        if (tableExists("payments")) {
            unlinkedPayments += jdbcTemplate.update(
                    "UPDATE payments SET class_enrollment_id = NULL WHERE class_enrollment_id IS NOT NULL");
            unlinkedPayments += jdbcTemplate.update(
                    "UPDATE payments SET coach_booking_id = NULL WHERE coach_booking_id IS NOT NULL");
        }

        int unlinkedPlans = 0;
        if (tableExists("training_plans")) {
            unlinkedPlans = jdbcTemplate.update(
                    "UPDATE training_plans SET class_id = NULL WHERE class_id IS NOT NULL");
        }

        int totalDeleted = 0;
        for (String table : TABLES_TO_DELETE_IN_ORDER) {
            if (tableExists(table)) {
                totalDeleted += jdbcTemplate.update("DELETE FROM " + table);
            }
        }

        log.info(
                "Legacy schedule slot reset complete: unlinked {} payment refs, {} training plan refs, deleted {} legacy schedule rows.",
                unlinkedPayments, unlinkedPlans, totalDeleted);
    }

    /**
     * Dời lớp active, buổi lớp scheduled và buổi PT confirmed từ hôm nay trở đi đang ở giờ slot cũ sang slot mới
     * cùng số. Lỗi trigger (ví dụ gói hội viên đã hết hạn) thì hoàn tác bước dời và trả {@code false} để không
     * dọn sạch dữ liệu.
     */
    private boolean shiftPreviousSlotRows() {
        List<TableCheck> targets = List.of(
                new TableCheck("classes", "status = 'active'"),
                new TableCheck("class_sessions", "status = 'scheduled' AND session_date >= " + CENTER_TODAY_SQL),
                new TableCheck("coach_bookings", "status = 'confirmed' AND booking_date >= " + CENTER_TODAY_SQL));
        jdbcTemplate.execute("SAVEPOINT previous_slot_shift");
        try {
            int shifted = 0;
            for (String[] shift : PREVIOUS_SLOT_SHIFTS) {
                for (TableCheck target : targets) {
                    if (tableExists(target.tableName())) {
                        shifted += jdbcTemplate.update(
                                "UPDATE " + target.tableName()
                                        + " SET start_time = CAST(? AS TIME), end_time = CAST(? AS TIME)"
                                        + " WHERE start_time = CAST(? AS TIME) AND end_time = CAST(? AS TIME) AND "
                                        + target.condition(),
                                shift[2], shift[3], shift[0], shift[1]);
                    }
                }
            }
            jdbcTemplate.execute("RELEASE SAVEPOINT previous_slot_shift");
            if (shifted > 0) {
                log.info("Shifted {} schedule rows from the previous 5-slot times to the 2h30 slots.", shifted);
            }
            return true;
        } catch (RuntimeException failure) {
            jdbcTemplate.execute("ROLLBACK TO SAVEPOINT previous_slot_shift");
            log.error("Could not shift schedule rows to the new slot times; skipped the legacy wipe to keep data. "
                    + "Fix the blocking rows and restart.", failure);
            return false;
        }
    }

    private boolean hasAnyLegacyScheduleRows() {
        for (TableCheck check : SCHEDULE_SOURCE_CHECKS) {
            if (!tableExists(check.tableName())) {
                continue;
            }
            String sql = "SELECT EXISTS (SELECT 1 FROM " + check.tableName() + " WHERE " + check.condition() + ")";
            Boolean hasLegacy = jdbcTemplate.queryForObject(sql, Boolean.class);
            if (Boolean.TRUE.equals(hasLegacy)) {
                return true;
            }
        }
        return false;
    }

    private boolean tableExists(String tableName) {
        Boolean exists = jdbcTemplate.queryForObject(TABLE_EXISTS_SQL, Boolean.class, tableName);
        return Boolean.TRUE.equals(exists);
    }
}
