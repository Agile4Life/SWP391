package com.swp391.scms.facilities;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử đơn vị cho {@link LegacyScheduleSlotResetRunner}. */
@ExtendWith(MockitoExtension.class)
class LegacyScheduleSlotResetRunnerTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void isNullSafeWhenJdbcTemplateIsNull() {
        LegacyScheduleSlotResetRunner runner = new LegacyScheduleSlotResetRunner(null);
        assertThatCode(() -> runner.run(null)).doesNotThrowAnyException();
    }

    @Test
    void doesNothingWhenAllRowsMatchCanonicalFiveSlots() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), anyString()))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(contains("SELECT EXISTS (SELECT 1 FROM "), eq(Boolean.class)))
                .thenReturn(Boolean.FALSE);

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void unlinksForeignKeysAndWipesLegacyScheduleTablesInSafeOrder() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), anyString()))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(contains("FROM classes WHERE"), eq(Boolean.class)))
                .thenReturn(Boolean.FALSE);
        when(jdbcTemplate.queryForObject(contains("FROM class_sessions WHERE"), eq(Boolean.class)))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.update(anyString())).thenReturn(1);

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        InOrder order = inOrder(jdbcTemplate);
        order.verify(jdbcTemplate).update("UPDATE payments SET class_enrollment_id = NULL WHERE class_enrollment_id IS NOT NULL");
        order.verify(jdbcTemplate).update("UPDATE payments SET coach_booking_id = NULL WHERE coach_booking_id IS NOT NULL");
        order.verify(jdbcTemplate).update("UPDATE training_plans SET class_id = NULL WHERE class_id IS NOT NULL");
        for (String table : List.of(
                "session_attendance",
                "session_evaluations",
                "coach_reviews",
                "session_bookings",
                "class_enrollments",
                "class_sessions",
                "classes",
                "coach_bookings")) {
            order.verify(jdbcTemplate).update("DELETE FROM " + table);
        }
    }

    @Test
    void skipsMissingOptionalTablesWithoutCrashing() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq("classes")))
                .thenReturn(Boolean.FALSE);
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq("class_sessions")))
                .thenReturn(Boolean.FALSE);
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq("coach_bookings")))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(contains("FROM coach_bookings WHERE"), eq(Boolean.class)))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq("payments")))
                .thenReturn(Boolean.FALSE);
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq("training_plans")))
                .thenReturn(Boolean.FALSE);
        for (String absent : List.of(
                "session_attendance",
                "session_evaluations",
                "coach_reviews",
                "session_bookings",
                "class_enrollments")) {
            when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq(absent)))
                    .thenReturn(Boolean.FALSE);
        }

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        verify(jdbcTemplate, never()).update(contains("UPDATE payments"));
        verify(jdbcTemplate, never()).update(contains("UPDATE training_plans"));
        verify(jdbcTemplate).update("DELETE FROM coach_bookings");
    }
}
