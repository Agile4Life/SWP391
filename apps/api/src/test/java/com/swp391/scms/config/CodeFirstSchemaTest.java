package com.swp391.scms.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.Entity;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

/**
 * Code-first guard: the JPA entities alone must be able to generate every table of
 * databaseschema.sql (no hand-written DDL) on both supported databases, without a live connection.
 */
class CodeFirstSchemaTest {

    private static final Path SCHEMA = Path.of("..", "..", "db", "databaseschema.sql");

    private static String generateDdl(String dialect) throws Exception {
        Path out = Files.createTempFile("ddl", ".sql");
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", dialect)
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", "false")
                .applySetting("hibernate.use_nationalized_character_data", "true")
                .applySetting("jakarta.persistence.schema-generation.database.action", "none")
                .applySetting("jakarta.persistence.schema-generation.scripts.action", "create")
                .applySetting("jakarta.persistence.schema-generation.scripts.create-target", out.toString())
                .build();
        try {
            MetadataSources sources = new MetadataSources(registry);
            ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
            scanner.findCandidateComponents("com.swp391.scms").forEach(bd -> {
                try {
                    sources.addAnnotatedClass(Class.forName(bd.getBeanClassName()));
                } catch (ClassNotFoundException e) {
                    throw new IllegalStateException(e);
                }
            });
            sources.buildMetadata().buildSessionFactory().close();
            return Files.readString(out, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static Set<String> schemaTables() throws IOException {
        Matcher m = Pattern.compile("CREATE TABLE dbo\\.(\\w+)", Pattern.CASE_INSENSITIVE)
                .matcher(Files.readString(SCHEMA, StandardCharsets.UTF_8));
        Set<String> tables = new TreeSet<>();
        while (m.find()) {
            tables.add(m.group(1).toLowerCase(Locale.ROOT));
        }
        return tables;
    }

    @ParameterizedTest
    @ValueSource(strings = {"org.hibernate.dialect.SQLServerDialect", "org.hibernate.dialect.PostgreSQLDialect"})
    void entitiesGenerateEveryTableOfTheReferenceSchema(String dialect) throws Exception {
        assertTrue(Files.exists(SCHEMA), "db/databaseschema.sql must be reachable from the test working dir");
        String ddl = generateDdl(dialect);
        Set<String> tables = schemaTables();
        assertTrue(tables.size() >= 30, "reference schema should list its tables");
        for (String table : tables) {
            assertTrue(ddl.matches("(?s).*create table (dbo\\.)?\\[?\"?" + table + "\\b.*"),
                    "No entity generates table " + table + " for " + dialect);
        }
    }

    @Test
    void paymentsReferenceSubscriptionsAndEnrollments() throws Exception {
        String ddl = generateDdl("org.hibernate.dialect.PostgreSQLDialect");
        assertTrue(ddl.contains("foreign key (subscription_id) references membership_subscriptions"));
        assertTrue(ddl.contains("foreign key (class_enrollment_id) references class_enrollments"));
    }

    @Test
    void postgresGeneratesStoredComputedColumnsAndNativeJson() throws Exception {
        String ddl = generateDdl("org.hibernate.dialect.PostgreSQLDialect");
        assertTrue(ddl.contains("generated always as (subtotal_amount + tax_amount) stored"), ddl);
        assertTrue(ddl.contains("generated always as (quantity * unit_price) stored"), ddl);
        assertTrue(ddl.contains("data jsonb"), ddl);
        assertTrue(ddl.contains("old_value jsonb"), ddl);
        assertTrue(ddl.contains("recommended_content jsonb"), ddl);
    }

    @ParameterizedTest
    @ValueSource(strings = {"org.hibernate.dialect.SQLServerDialect", "org.hibernate.dialect.PostgreSQLDialect"})
    void preservesReferenceCheckConstraintsExceptJsonWhichUsesNativeMapping(String dialect) throws Exception {
        String ddl = generateDdl(dialect);
        Matcher checks = Pattern.compile("CONSTRAINT\\s+(ck_\\w+)\\s+CHECK", Pattern.CASE_INSENSITIVE)
                .matcher(Files.readString(SCHEMA, StandardCharsets.UTF_8));
        while (checks.find()) {
            String name = checks.group(1).toLowerCase(Locale.ROOT);
            if (!name.endsWith("_json")) {
                assertTrue(ddl.contains("constraint " + name + " check"), "Missing CHECK: " + name + " on " + dialect);
            }
        }
    }
}
