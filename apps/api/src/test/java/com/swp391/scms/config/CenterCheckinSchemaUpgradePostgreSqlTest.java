package com.swp391.scms.config;

import com.swp391.scms.config.trigger.PostgreSqlTriggerProvider;
import jakarta.persistence.Entity;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises an existing database upgrade in a generated schema; never changes public. */
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class CenterCheckinSchemaUpgradePostgreSqlTest {

    @Test
    void upgradesLegacyCheckinsAfterHibernateAndPreservesHistoryForeignKeyAndMembershipTrigger() throws Exception {
        String schema = "scrum91_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = SupabaseTestDatabase.connect();
             var statement = connection.createStatement()) {
            String originalSchema = connection.getSchema();
            statement.execute("create schema \"" + schema + "\"");
            try {
                connection.setSchema(schema);
                var source = new SingleConnectionDataSource(connection, true);
                var jdbc = new JdbcTemplate(source);
                synchronizeEntities(source, schema, "create");
                jdbc.execute("alter table center_checkins alter column member_id set not null");

                long role = jdbc.queryForObject("insert into roles (code, name, created_at) "
                        + "values ('MEMBER', 'Upgrade fixture', now()) returning id", Long.class);
                long member = jdbc.queryForObject("""
                        insert into users (role_id, full_name, email, password_hash, status, created_at, updated_at)
                        values (?, 'Upgrade fixture', 'upgrade@example.invalid', 'unused', 'active', now(), now()) returning id
                        """, Long.class, role);
                jdbc.update("insert into members (user_id, membership_code, join_date, fitness_level) "
                        + "values (?, 'UPGRADE-91', current_date, 'beginner')", member);
                long history = jdbc.queryForObject("insert into center_checkins (member_id, check_in_time, method, status) "
                        + "values (?, now(), 'qr', 'DENIED') returning id", Long.class, member);
                long foreignKey = memberForeignKey(jdbc, schema);

                // Reproduce the real gap: ddl-auto=update retains the legacy NOT NULL column.
                synchronizeEntities(source, schema, "update");
                assertEquals("NO", nullable(jdbc, schema));
                assertThrows(DataIntegrityViolationException.class, () -> deniedUnknownMember(jdbc));

                var initializer = new DatabaseTriggerInitializer(source, jdbc, List.of(new PostgreSqlTriggerProvider()));
                initializer.run(new DefaultApplicationArguments());
                assertEquals("YES", nullable(jdbc, schema));
                deniedUnknownMember(jdbc);
                assertEquals(member, jdbc.queryForObject("select member_id from center_checkins where id = ?", Long.class, history));
                assertEquals(foreignKey, memberForeignKey(jdbc, schema));
                assertEquals(2, jdbc.queryForObject("select count(*) from center_checkins", Integer.class));

                for (Long candidate : new Long[]{null, member}) {
                    var error = assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                            "insert into center_checkins (member_id, check_in_time, method, status) values (?, now(), 'qr', 'GRANTED')",
                            candidate));
                    assertEquals("23514", assertInstanceOf(SQLException.class, error.getMostSpecificCause()).getSQLState());
                }
                var invalidMember = assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                        "insert into center_checkins (member_id, check_in_time, method, status) values (999999999, now(), 'qr', 'DENIED')"));
                assertEquals("23503", assertInstanceOf(SQLException.class, invalidMember.getMostSpecificCause()).getSQLState());

                initializer.run(new DefaultApplicationArguments());
                deniedUnknownMember(jdbc);
                assertEquals(3, jdbc.queryForObject("select count(*) from center_checkins", Integer.class));
                assertEquals(foreignKey, memberForeignKey(jdbc, schema));
            } finally {
                connection.setSchema(originalSchema);
                assertTrue(schema.matches("scrum91_upgrade_[a-f0-9]{32}"));
                statement.execute("drop schema if exists \"" + schema + "\" cascade");
            }
        }
    }

    private static void synchronizeEntities(SingleConnectionDataSource source, String schema, String action) throws Exception {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.connection.datasource", source)
                .applySetting("hibernate.default_schema", schema)
                .applySetting("hibernate.hbm2ddl.auto", action)
                .applySetting("hibernate.hbm2ddl.halt_on_error", true)
                .build();
        try {
            var mappings = new MetadataSources(registry);
            var scanner = new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
            for (var entity : scanner.findCandidateComponents("com.swp391.scms")) {
                mappings.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
            }
            mappings.buildMetadata().buildSessionFactory().close();
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static String nullable(JdbcTemplate jdbc, String schema) {
        return jdbc.queryForObject("select is_nullable from information_schema.columns "
                        + "where table_schema = ? and table_name = 'center_checkins' and column_name = 'member_id'",
                String.class, schema);
    }

    private static long memberForeignKey(JdbcTemplate jdbc, String schema) {
        return jdbc.queryForObject("select oid from pg_constraint where conrelid = ?::regclass "
                        + "and contype = 'f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (member_id)%'",
                Long.class, schema + ".center_checkins");
    }

    private static void deniedUnknownMember(JdbcTemplate jdbc) {
        jdbc.update("insert into center_checkins (member_id, check_in_time, method, status, denial_reason) "
                + "values (null, now(), 'qr', 'DENIED', 'Unknown QR fixture')");
    }

}
