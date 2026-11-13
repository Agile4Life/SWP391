package com.swp391.scms.config.trigger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Component
public class PostgreSqlTriggerProvider implements DatabaseTriggerProvider {

    private static final Logger log = LoggerFactory.getLogger(PostgreSqlTriggerProvider.class);
    private final boolean auditEntityTypeUpgradeEnabled;

    public PostgreSqlTriggerProvider() {
        this(false);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public PostgreSqlTriggerProvider(
            @org.springframework.beans.factory.annotation.Value("${app.database.audit-entity-type-upgrade-enabled:false}")
            boolean auditEntityTypeUpgradeEnabled) {
        this.auditEntityTypeUpgradeEnabled = auditEntityTypeUpgradeEnabled;
    }

    @Override
    public boolean supports(String databaseProductName) {
        return databaseProductName != null && databaseProductName.toLowerCase().contains("postgresql");
    }

    @Override
    public void applyTriggers(JdbcTemplate jdbcTemplate) {
        CenterCheckinSchemaUpgrade.relaxMemberNullability(jdbcTemplate);
        if (auditEntityTypeUpgradeEnabled) {
            AuditEntityTypeSchemaUpgrade.allowCoachBookings(jdbcTemplate);
        } else {
            log.info("Audit entity-type CHECK migration disabled; explicit deployment opt-in is required.");
        }
        ClassPathResource resource = new ClassPathResource("db/triggers/postgresql-triggers.sql");
        if (!resource.exists()) {
            throw new IllegalStateException("Mandatory PostgreSQL trigger script is missing");
        }
        try (InputStream is = resource.getInputStream()) {
            jdbcTemplate.execute(new String(is.readAllBytes(), StandardCharsets.UTF_8));
            log.info("PostgreSQL invariant triggers installed.");
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read PostgreSQL trigger script", e);
        } catch (DataAccessException e) {
            throw new IllegalStateException("Cannot install mandatory PostgreSQL triggers", e);
        }
    }
}
