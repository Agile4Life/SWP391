package com.swp391.scms.facilities;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử đơn vị cho {@link LegacyScheduleSlotResetRunner}. */
@ExtendWith(MockitoExtension.class)
// Bước dời giờ gọi update(String, Object...) ngoài các stub update(String) của từng test.
@MockitoSettings(strictness = Strictness.LENIENT)
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
                "class_waitlists",
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
                "class_enrollments",
                "class_waitlists")) {
            when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), eq(absent)))
                    .thenReturn(Boolean.FALSE);
        }

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        verify(jdbcTemplate, never()).update(contains("UPDATE payments"));
        verify(jdbcTemplate, never()).update(contains("UPDATE training_plans"));
        verify(jdbcTemplate).update("DELETE FROM coach_bookings");
    }

    @Test
    void doesNothingWhenDisabledByConfiguration() {
        new LegacyScheduleSlotResetRunner(jdbcTemplate, false).run(null);
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void checksOnlyActiveNonNullClassesAndUpcomingScheduledOrConfirmedRows() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), anyString()))
                .thenReturn(Boolean.TRUE);
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        when(jdbcTemplate.queryForObject(sqlCaptor.capture(), eq(Boolean.class)))
                .thenReturn(Boolean.FALSE);

        new LegacyScheduleSlotResetRunner(jdbcTemplate, true).run(null);

        List<String> queries = sqlCaptor.getAllValues();
        assertThat(queries).hasSize(3);

        String classesSql = queries.get(0);
        assertThat(classesSql)
                .contains("FROM classes WHERE")
                .contains("status = 'active'")
                .contains("start_time IS NOT NULL AND end_time IS NOT NULL")
                .doesNotContain("start_time IS NULL")
                .doesNotContain("end_time IS NULL");

        String sessionsSql = queries.get(1);
        assertThat(sessionsSql)
                .contains("FROM class_sessions WHERE")
                .contains("status = 'scheduled'")
                .contains("session_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date");

        String bookingsSql = queries.get(2);
        assertThat(bookingsSql)
                .contains("FROM coach_bookings WHERE")
                .contains("status = 'confirmed'")
                .contains("booking_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date");

        verify(jdbcTemplate, never()).update(anyString());
    }

    @Test
    void shiftsPreviousSlotRowsFromSlotFiveDownBeforeCheckingLegacyRows() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), anyString()))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.queryForObject(contains("SELECT EXISTS (SELECT 1 FROM "), eq(Boolean.class)))
                .thenReturn(Boolean.FALSE);

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        InOrder order = inOrder(jdbcTemplate);
        order.verify(jdbcTemplate).execute("SAVEPOINT previous_slot_shift");
        for (String[] shift : LegacyScheduleSlotResetRunner.PREVIOUS_SLOT_SHIFTS) {
            for (String table : List.of("classes", "class_sessions", "coach_bookings")) {
                order.verify(jdbcTemplate).update(
                        contains("UPDATE " + table + " SET start_time"),
                        eq(shift[2]), eq(shift[3]), eq(shift[0]), eq(shift[1]));
            }
        }
        order.verify(jdbcTemplate).execute("RELEASE SAVEPOINT previous_slot_shift");
        assertThat(LegacyScheduleSlotResetRunner.PREVIOUS_SLOT_SHIFTS.get(0)[0]).isEqualTo("17:00");
    }

    @Test
    void rollsBackShiftAndSkipsWipeWhenTriggerRejectsShiftedRow() {
        when(jdbcTemplate.queryForObject(contains("information_schema.tables"), eq(Boolean.class), anyString()))
                .thenReturn(Boolean.TRUE);
        when(jdbcTemplate.update(contains("UPDATE coach_bookings SET start_time"), any(), any(), any(), any()))
                .thenThrow(new DataIntegrityViolationException("trg_enrollments_check_membership"));

        new LegacyScheduleSlotResetRunner(jdbcTemplate).run(null);

        verify(jdbcTemplate).execute("ROLLBACK TO SAVEPOINT previous_slot_shift");
        verify(jdbcTemplate, never()).update(contains("DELETE FROM"));
        verify(jdbcTemplate, never()).queryForObject(contains("SELECT EXISTS (SELECT 1 FROM "), eq(Boolean.class));
    }
}
