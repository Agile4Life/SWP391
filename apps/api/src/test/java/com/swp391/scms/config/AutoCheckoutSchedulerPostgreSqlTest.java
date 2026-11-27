package com.swp391.scms.config;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.config.CronTask;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Chỉ dùng DB test được cấp riêng; schema UUID và TLS dùng cùng harness integration hiện có. */
@SpringBootTest
@ActiveProfiles("supabase")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class AutoCheckoutSchedulerPostgreSqlTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired Clock clock;
    @Autowired ScheduledAnnotationBeanPostProcessor scheduling;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) throws Exception {
        OperationsConcurrencyPostgreSqlTest.database(properties);
        // Bật đúng cron production trong context riêng; không tự gọi phương thức job trong bài test này.
        properties.add("app.attendance.auto-checkout.cron", () -> "0 * * * * ?");
    }

    @AfterAll
    static void cleanup() throws Exception {
        OperationsConcurrencyPostgreSqlTest.cleanupSchema();
    }

    @Test
    void registeredMinuteCronActuallyClosesAnOverdueVisit() throws Exception {
        assertEquals("Asia/Ho_Chi_Minh", clock.getZone().getId());
        assertTrue(scheduling.getScheduledTasks().stream().anyMatch(task ->
                task.getTask() instanceof CronTask cron && cron.getExpression().equals("0 * * * * ?")));
        long member = jdbc.queryForObject("""
                insert into users (role_id, full_name, email, password_hash, status, created_at, updated_at)
                values ((select id from roles where code='MEMBER'), 'Cron fixture', ?, 'unused', 'active', now(), now()) returning id
                """, Long.class, UUID.randomUUID() + "@example.invalid");
        jdbc.update("insert into members (user_id, membership_code, join_date, fitness_level) values (?, ?, current_date, 'beginner')",
                member, "CRON-" + member);
        jdbc.update("""
                insert into membership_subscriptions (member_id, package_id, start_date, end_date, status, qr_code, created_at, updated_at)
                values (?, (select min(id) from membership_packages), current_date - 30, current_date + 30, 'active', ?, now(), now())
                """, member, UUID.randomUUID().toString());
        LocalDateTime entered = LocalDateTime.now(clock).minusHours(9).withNano(0);
        long visit = jdbc.queryForObject("""
                insert into center_checkins (member_id, check_in_time, method, status, gate)
                values (?, ?, 'qr', 'GRANTED', 'Cron test') returning id
                """, Long.class, member, entered);
        assertNull(end(visit));
        long started = System.nanoTime();
        long deadline = started + java.util.concurrent.TimeUnit.SECONDS.toNanos(75);
        while (end(visit) == null && System.nanoTime() < deadline) Thread.sleep(200);
        assertEquals(entered.plusHours(8), end(visit));
        assertEquals("SYSTEM_AUTO_CHECKOUT", jdbc.queryForObject("select notes from center_checkins where id=?", String.class, visit));
        System.out.println("AUTO_CHECKOUT_CRON: scheduled execution verified; elapsedMillis="
                + java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
    }

    private LocalDateTime end(long id) {
        return jdbc.queryForObject("select check_out_time from center_checkins where id=?", LocalDateTime.class, id);
    }
}
