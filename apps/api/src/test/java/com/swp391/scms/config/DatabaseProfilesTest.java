package com.swp391.scms.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseProfilesTest {
    private ApplicationContextRunner supabase() {
        return new ApplicationContextRunner()
                .withInitializer(context -> {
                    context.getEnvironment().getPropertySources().remove("systemEnvironment");
                    new ConfigDataApplicationContextInitializer().initialize(context);
                })
                .withUserConfiguration(SupabaseConfiguration.class)
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class))
                .withPropertyValues("spring.profiles.active=supabase",
                        "SPRING_DATASOURCE_URL=jdbc:postgresql://pooler.example.invalid:5432/postgres",
                        "SPRING_DATASOURCE_USERNAME=postgres.test-project",
                        "SPRING_DATASOURCE_PASSWORD=test-only-password",
                        "APP_JWT_SECRET=test-only-signing-secret");
    }

    @Test
    void supabaseUsesPostgresWithSslAndBoundedPoolWithoutLocalOtp() {
        supabase().run(context -> {
            assertThat(context).hasNotFailed();
            HikariDataSource ds = context.getBean(HikariDataSource.class);
            assertThat(ds.getDriverClassName()).isEqualTo("org.postgresql.Driver");
            assertThat(ds.getJdbcUrl()).startsWith("jdbc:postgresql:");
            assertThat(ds.getUsername()).isEqualTo("postgres.test-project");
            assertThat(ds.getPassword()).isEqualTo("test-only-password");
            assertThat(ds.getDataSourceProperties().getProperty("sslmode")).isEqualTo("require");
            assertThat(ds.getMaximumPoolSize()).isEqualTo(5);
            assertThat(context.getEnvironment().getProperty("app.auth.debug-otp-enabled", Boolean.class)).isFalse();
            assertThat(context.getEnvironment().getActiveProfiles()).doesNotContain("local");
        });
    }

    @Test
    void sslCertificateVerificationCanBeEnabledThroughEnvironment() {
        supabase().withPropertyValues("DB_SSL_MODE=verify-full", "DB_SSL_ROOT_CERT=C:/certs/root.crt")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    HikariDataSource ds = context.getBean(HikariDataSource.class);
                    assertThat(ds.getDataSourceProperties().getProperty("sslmode")).isEqualTo("verify-full");
                    assertThat(ds.getDataSourceProperties().getProperty("sslrootcert")).isEqualTo("C:/certs/root.crt");
                });
    }

    @Test
    void rejectsLocalProfileAndPlaintextSslOnSupabase() {
        supabase().withPropertyValues("spring.profiles.active=supabase,local")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("DB_SSL_MODE=disable")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("SPRING_DATASOURCE_URL=jdbc:postgresql://example.invalid/postgres?sslmode=disable")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void rejectsMissingCredentialsBeforeConnecting() {
        supabase().withPropertyValues("SPRING_DATASOURCE_PASSWORD=")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("APP_JWT_SECRET=")
                .run(context -> assertThat(context).hasFailed());
    }
}
