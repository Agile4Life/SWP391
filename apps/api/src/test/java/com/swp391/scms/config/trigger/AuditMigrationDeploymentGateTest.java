package com.swp391.scms.config.trigger;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Spring property binding, without Boot startup, datasource, environment credentials or schema writes. */
class AuditMigrationDeploymentGateTest {
    private ApplicationContextRunner context() {
        return new ApplicationContextRunner()
                .withInitializer(ctx -> ctx.getEnvironment().getPropertySources().remove("systemEnvironment"))
                .withUserConfiguration(PostgreSqlTriggerProvider.class);
    }

    @Test void migrationIsDisabledWhenNoDeploymentFlagIsProvided() {
        context().run(ctx -> check(ctx.getBean(PostgreSqlTriggerProvider.class), 1));
    }

    @ParameterizedTest
    @CsvSource({"false,1", "true,2"})
    void onlyExplicitOptInAddsTheAuditMigration(String enabled, int callbacks) {
        context().withPropertyValues("app.database.audit-entity-type-upgrade-enabled=" + enabled)
                .run(ctx -> check(ctx.getBean(PostgreSqlTriggerProvider.class), callbacks));
    }

    private void check(PostgreSqlTriggerProvider provider, int callbacks) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        provider.applyTriggers(jdbc);
        // The legacy check-in upgrade remains; only approved deployment enables the additional audit callback.
        verify(jdbc, times(callbacks)).execute(org.mockito.ArgumentMatchers.<ConnectionCallback<Void>>any());
        verify(jdbc).execute(contains("trg_pt_schedule_booking"));
    }
}
