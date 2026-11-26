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
 * định (07:00–19:30).
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
                    + "OR (start_time = TIME '09:45:00' AND end_time = TIME '11:15:00') "
                    + "OR (start_time = TIME '11:30:00' AND end_time = TIME '14:00:00') "
                    + "OR (start_time = TIME '14:15:00' AND end_time = TIME '16:45:00') "
                    + "OR (start_time = TIME '17:00:00' AND end_time = TIME '19:30:00')";

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
