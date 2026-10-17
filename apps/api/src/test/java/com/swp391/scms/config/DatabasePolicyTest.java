package com.swp391.scms.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs in CI: legacy reference SQL must never become an application dependency. */
class DatabasePolicyTest {
    private static final Path ROOT = Path.of("..", "..");
    private static final Pattern LEGACY_DATABASE = Pattern.compile(
            "jdbc:(?:sqlserver|h2|mysql):|mssql-jdbc|com\\.microsoft\\.sqlserver|com\\.h2database|org\\.h2\\b"
                    + "|SQLServerDialect|H2Dialect|SqlServerTrigger(?:Provider|Strategy)|H2Trigger(?:Provider|Strategy)"
                    + "|\\bdbo\\.|\\bNVARCHAR\\b|\\b(?:ISJSON|SYSDATETIME|COL_LENGTH)\\s*\\("
                    + "|\\bCREATE\\s+TABLE\\b|flyway|liquibase",
            Pattern.CASE_INSENSITIVE);

    @Test
    void runtimeAndDependenciesUsePostgresOnly() throws Exception {
        assertNoLegacySql(Path.of("pom.xml"));
        try (var files = Files.walk(Path.of("src", "main"))) {
            for (Path file : files.filter(Files::isRegularFile).toList()) {
                assertThat(file.getFileName().toString()).doesNotMatch(
                        "(?i).*(?:sqlserver|mssql|h2-triggers).*|application-(?:local|postgresql|h2)\\.ya?ml");
                if (file.toString().endsWith(".sql")) {
                    assertThat(file).as("Only the PostgreSQL trigger provider owns runtime SQL")
                            .isEqualTo(Path.of("src/main/resources/db/triggers/postgresql-triggers.sql"));
                }
                if (file.toString().matches(".*\\.(?:java|properties|ya?ml|sql|xml)$")) assertNoLegacySql(file);
            }
        }
    }

    @Test
    void newHandwrittenSchemaMigrationsCannotBeAdded() throws Exception {
        Set<String> historical = Set.of("databaseschema.sql", "migrations/V1__init_finance_computed_columns.sql",
                "migrations/V2__add_user_username.sql", "migrations/V3__create_otp_challenges.sql");
        Path database = ROOT.resolve("db");
        try (var files = Files.walk(database)) {
            for (Path file : files.filter(Files::isRegularFile).toList()) {
                if (file.toString().endsWith(".sql")) {
                    assertThat(historical).as("Define schema changes in JPA entities, not %s", file)
                            .contains(database.relativize(file).toString().replace('\\', '/'));
                }
            }
        }
    }

    @Test
    void contributorInstructionsDoNotRecommendRetiredDatabaseAdapters() throws Exception {
        for (String guide : new String[]{".agents/README.md", ".agents/skills/scms-development/SKILL.md",
                ".agents/workflows/scms-development.md"}) {
            assertThat(Files.readString(ROOT.resolve(guide))).as(guide)
                    .contains("Supabase PostgreSQL")
                    .doesNotContain("SqlServerTriggerStrategy", "H2TriggerStrategy", "Spring Boot, SQL Server");
        }
    }

    private static void assertNoLegacySql(Path file) throws Exception {
        assertThat(LEGACY_DATABASE.matcher(Files.readString(file)).find())
                .as("Retired database dependency or SQL syntax in %s", file).isFalse();
    }
}
