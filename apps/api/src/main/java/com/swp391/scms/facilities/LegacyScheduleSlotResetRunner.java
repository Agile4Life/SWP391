package com.swp391.scms.facilities;

import java.util.List;
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
 * Chạy một lần duy nhất (idempotent) khi khởi động trước {@code DemoDataSeeder} (@Order 200) và
 * {@code DemoClassSeeder} (@Order 210) để dọn sạch dữ liệu lịch cũ không khớp 5 slot cố định (07:00–19:30).
 *
 * <p>Nếu mọi bản ghi trong {@code classes}, {@code class_sessions} và {@code coach_bookings} đều đã thuộc 5 slot
 * chuẩn (hoặc các bảng đều trống), runner kết thúc ngay (no-op) để không bao giờ ảnh hưởng tới dữ liệu mới.
 */
@Component
@Order(195)
public class LegacyScheduleSlotResetRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyScheduleSlotResetRunner.class);

    private static final String TABLE_EXISTS_SQL =
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    + "WHERE table_schema = current_schema() AND table_name = ?)";

    private static final String NON_CANONICAL_SLOT_CONDITION =
            "start_time IS NULL OR end_time IS NULL OR NOT ("
                    + "(start_time = TIME '07:00:00' AND end_time = TIME '09:30:00') "
                    + "OR (start_time = TIME '09:45:00' AND end_time = TIME '11:15:00') "
                    + "OR (start_time = TIME '11:30:00' AND end_time = TIME '14:00:00') "
                    + "OR (start_time = TIME '14:15:00' AND end_time = TIME '16:45:00') "
                    + "OR (start_time = TIME '17:00:00' AND end_time = TIME '19:30:00')"
                    + ")";

    private static final List<String> SCHEDULE_SOURCE_TABLES = List.of(
            "classes",
            "class_sessions",
            "coach_bookings"
    );

    private static final List<String> TABLES_TO_DELETE_IN_ORDER = List.of(
            "session_attendance",
            "session_evaluations",
            "coach_reviews",
            "session_bookings",
            "class_enrollments",
            "class_sessions",
            "classes",
            "coach_bookings"
    );

    private final JdbcTemplate jdbcTemplate;

    /** Nhận JdbcTemplate tùy chọn (có thể null trong unit test không có datasource). */
    @Autowired
    public LegacyScheduleSlotResetRunner(@Autowired(required = false) JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
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
        for (String table : SCHEDULE_SOURCE_TABLES) {
            if (!tableExists(table)) {
                continue;
            }
            String sql = "SELECT EXISTS (SELECT 1 FROM " + table + " WHERE " + NON_CANONICAL_SLOT_CONDITION + ")";
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
