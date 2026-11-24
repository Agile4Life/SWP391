package com.swp391.scms.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bộ kiểm thử cho DatabaseProfiles (database profiles). */
class DatabaseProfilesTest {
    /** Hàm trợ giúp của test: tạo cấu hình môi trường giả cho database. */
    private ApplicationContextRunner database() {
        return new ApplicationContextRunner()
                .withInitializer(context -> {
                    context.getEnvironment().getPropertySources().remove("systemEnvironment");
                    new ConfigDataApplicationContextInitializer().initialize(context);
                })
                .withUserConfiguration(SupabaseConfiguration.class)
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class))
                .withPropertyValues("SPRING_DATASOURCE_URL=jdbc:postgresql://pooler.example.invalid:5432/postgres",
                        "SPRING_DATASOURCE_USERNAME=postgres.test-project",
                        "SPRING_DATASOURCE_PASSWORD=test-only-password",
                        "APP_JWT_SECRET=test-only-signing-secret");
    }

    /** Hàm trợ giúp của test: tạo cấu hình profile supabase mẫu. */
    private ApplicationContextRunner supabase() {
        return database().withPropertyValues("spring.profiles.active=supabase");
    }

    /** Kiểm thử: cấu hình mặc định dùng Supabase với SSL và không có OTP debug cục bộ. */
    @Test
    void defaultConfigurationUsesSupabaseSslWithoutLocalDebugOtp() {
        database().run(context -> {
            assertThat(context).hasNotFailed();
            HikariDataSource ds = context.getBean(HikariDataSource.class);
            assertThat(ds.getDriverClassName()).isEqualTo("org.postgresql.Driver");
            assertThat(ds.getDataSourceProperties().getProperty("sslmode")).isEqualTo("require");
            assertThat(context.getEnvironment().getProperty("app.auth.debug-otp-enabled", Boolean.class)).isFalse();
        });
    }

    /** Kiểm thử: profile supabase dùng PostgreSQL với SSL, pool có giới hạn và không có OTP cục bộ. */
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

    /** Kiểm thử: có thể bật xác minh chứng chỉ SSL qua biến môi trường. */
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

    /** Kiểm thử: từ chối profile local và SSL dạng plaintext trên Supabase. */
    @Test
    void rejectsLocalProfileAndPlaintextSslOnSupabase() {
        supabase().withPropertyValues("spring.profiles.active=supabase,local")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("DB_SSL_MODE=disable")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("SPRING_DATASOURCE_URL=jdbc:postgresql://example.invalid/postgres?sslmode=disable")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("SPRING_DATASOURCE_URL=jdbc:mysql://example.invalid/scms")
                .run(context -> assertThat(context).hasFailed());
    }

    /** Kiểm thử: từ chối thiếu thông tin đăng nhập trước khi kết nối. */
    @Test
    void rejectsMissingCredentialsBeforeConnecting() {
        supabase().withPropertyValues("SPRING_DATASOURCE_PASSWORD=")
                .run(context -> assertThat(context).hasFailed());
        supabase().withPropertyValues("APP_JWT_SECRET=")
                .run(context -> assertThat(context).hasFailed());
    }

    /** Kiểm thử: từ chối các profile database độc lập bỏ qua Supabase. */
    @Test
    void rejectsStandaloneDatabaseProfilesThatBypassSupabase() {
        for (String profile : new String[]{"postgresql", "local", "sqlserver", "h2"}) {
            database().withPropertyValues("spring.profiles.active=" + profile)
                    .run(context -> assertThat(context).hasFailed());
        }
    }

    /** Kiểm thử: từ chối profile development khi kết hợp với supabase. */
    @Test
    void rejectsDevelopmentProfileWhenCombinedWithSupabase() {
        for (String profile : new String[]{"postgresql", "local", "sqlserver", "h2"}) {
            supabase().withPropertyValues("spring.profiles.active=supabase," + profile)
                    .run(context -> assertThat(context).hasFailed());
        }
    }

    /** Kiểm thử: kết nối tích hợp trực tiếp từ chối TLS và URL không an toàn trước khi mở JDBC. */
    @Test
    void directIntegrationConnectionsRejectUnsafeTlsAndUrlBeforeOpeningJdbc() {
        var settings = new java.util.Properties();
        settings.setProperty("sslmode", "disable");
        assertThatThrownBy(() -> SupabaseTestDatabase.connect("jdbc:postgresql://example.invalid/postgres", settings))
                .isInstanceOf(IllegalStateException.class);
        settings.setProperty("sslmode", "require");
        for (String query : new String[]{"sslmode=disable", "user=other", "password=other", "ssl=false"}) {
            assertThatThrownBy(() -> SupabaseTestDatabase.connect("jdbc:postgresql://example.invalid/postgres?" + query, settings))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
