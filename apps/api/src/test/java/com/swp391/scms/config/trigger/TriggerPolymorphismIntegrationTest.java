package com.swp391.scms.config.trigger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Bộ kiểm thử đa hình trigger cho TriggerPolymorphism.
 * Kiểm tra provider PostgreSQL nạp đủ các trigger bắt buộc P2, P3 và P4.
 */
class TriggerPolymorphismIntegrationTest {

    /** Kiểm thử: trigger PostgreSQL chứa đầy đủ các bất biến nghiệp vụ. */
    @Test
    @DisplayName("P2/P3/P4 triggers: PostgreSQL trigger script must contain all mandatory business invariants")
    void testPostgreSqlTriggersContainAllInvariants() throws Exception {
        ClassPathResource resource = new ClassPathResource("db/triggers/postgresql-triggers.sql");
        assertTrue(resource.exists(), "PostgreSQL trigger script must exist in classpath");

        String sql;
        try (InputStream is = resource.getInputStream()) {
            sql = new String(is.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
        }

        // P2: Kiểm tra sức chứa lớp học
        assertTrue(sql.contains("scms_check_enrollment_capacity"), "Must contain P2 capacity check function");
        assertTrue(sql.contains("trg_enrollments_check_capacity"), "Must contain P2 capacity trigger");

        // P3: Trùng lịch (Huấn luyện viên & Phòng tập) và chuẩn 5 slot cố định (07:00–19:30)
        assertTrue(sql.contains("scms_is_valid_schedule_slot"), "Must contain 5-slot validation helper function");
        assertTrue(sql.contains("trg_schedule_invalid_slot"), "Must enforce 5-slot constraint in triggers");
        assertFalse(sql.contains("trg_coach_bookings_rest_required"), "Coach 3-consecutive-slot rest trigger must be removed");
        assertTrue(sql.contains("scms_check_session_conflict"), "Must contain P3 conflict check function");
        assertTrue(sql.contains("trg_sessions_check_conflict"), "Must contain P3 conflict trigger");
        assertTrue(sql.contains("trg_sessions_check_discipline_conflict"), "Must contain same-discipline no-overlap constraint");
        assertTrue(sql.contains("scms_guard_member_class_overlap"), "Must forbid one member in two overlapping classes");
        assertTrue(sql.contains("trg_member_overlap_session_booking"), "Must guard per-session bookings against member overlap");
        assertTrue(sql.contains("coach_id"), "Must check coach time overlap");
        assertTrue(sql.contains("room_id"), "Must check room time overlap");

        // P4: Bất biến gói thành viên (Ghi danh & Check-in)
        assertTrue(sql.contains("scms_require_active_membership_for_enrollment"), "Must contain P4 enrollment membership check function");
        assertTrue(sql.contains("scms_require_active_membership_for_checkin"), "Must contain P4 checkin membership check function");
        assertTrue(sql.contains("trg_checkins_check_membership"), "Must contain P4 checkin trigger");
        assertTrue(sql.contains("active"), "Must verify subscription status is active");
    }

    /** Kiểm thử: provider PostgreSQL được nhận diện và hỗ trợ đúng. */
    @ParameterizedTest
    @ValueSource(strings = {"PostgreSQL", "PostgreSQL 16", "postgresql"})
    @DisplayName("PostgreSqlTriggerProvider should correctly support PostgreSQL database names")
    void testPostgreSqlProviderSupport(String dbName) {
        PostgreSqlTriggerProvider provider = new PostgreSqlTriggerProvider();
        assertTrue(provider.supports(dbName));
        assertFalse(provider.supports(null));
        assertFalse(provider.supports("MySQL"));
    }

    /** Kiểm thử: luồng thực thi trigger chạy đúng từ đầu đến cuối. */
    @Test
    @DisplayName("DatabaseTriggerProvider should execute trigger statements cleanly")
    void testTriggerExecutionExecutionFlow() {
        JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
        List<String> executedStatements = new ArrayList<>();

        doAnswer(inv -> {
            executedStatements.add(inv.getArgument(0));
            return null;
        }).when(mockJdbc).execute(anyString());

        PostgreSqlTriggerProvider postgreSqlProvider = new PostgreSqlTriggerProvider();
        postgreSqlProvider.applyTriggers(mockJdbc);

        assertFalse(executedStatements.isEmpty(), "PostgreSQL statements must be executed");
        assertEquals(1, executedStatements.size(), "PostgreSQL executes trigger script as a single batch");
    }
}
