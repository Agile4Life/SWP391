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
 * Bộ kiểm thử cổng triển khai nâng cấp audit AuditMigrationDeploymentGate.
 * Chỉ kiểm tra ánh xạ thuộc tính Spring, không khởi chạy Spring Boot, datasource, thông tin môi trường hay ghi schema.
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
        // Bước nâng cấp check-in luôn chạy; bước nâng cấp audit thêm callback thứ hai trừ khi bị tắt.
        verify(jdbc, times(callbacks)).execute(org.mockito.ArgumentMatchers.<ConnectionCallback<Void>>any());
        verify(jdbc).execute(contains("trg_pt_schedule_booking"));
    }
}
