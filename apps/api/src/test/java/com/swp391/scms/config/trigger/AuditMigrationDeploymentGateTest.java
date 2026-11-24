package com.swp391.scms.config.trigger;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Bộ kiểm thử cho AuditMigrationDeploymentGate (audit migration deployment gate).
 *
 * Spring property binding, without Boot startup, datasource, environment credentials or schema writes.
 */
class AuditMigrationDeploymentGateTest {
    /** Hàm trợ giúp của test: dựng ApplicationContext để thử cổng migration audit. */
    private ApplicationContextRunner context() {
        return new ApplicationContextRunner()
                .withInitializer(ctx -> ctx.getEnvironment().getPropertySources().remove("systemEnvironment"))
                .withUserConfiguration(PostgreSqlTriggerProvider.class);
    }

    @Test void migrationRunsByDefault() {
        context().run(ctx -> check(ctx.getBean(PostgreSqlTriggerProvider.class), 2));
    }

    /** Kiểm thử: cờ cấu hình có thể tắt migration audit. */
    @ParameterizedTest
    @CsvSource({"false,1", "true,2"})
    void theFlagCanTurnTheAuditMigrationOff(String enabled, int callbacks) {
        context().withPropertyValues("app.database.audit-entity-type-upgrade-enabled=" + enabled)
                .run(ctx -> check(ctx.getBean(PostgreSqlTriggerProvider.class), callbacks));
    }

    /** Hàm trợ giúp của test: kiểm tra trạng thái của cổng migration. */
    private void check(PostgreSqlTriggerProvider provider, int callbacks) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        provider.applyTriggers(jdbc);
        // The check-in upgrade always runs; the audit upgrade adds a second callback unless turned off.
        verify(jdbc, times(callbacks)).execute(org.mockito.ArgumentMatchers.<ConnectionCallback<Void>>any());
        verify(jdbc).execute(contains("trg_pt_schedule_booking"));
    }
}
