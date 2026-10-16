package com.swp391.scms.config.trigger;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Installs mandatory PostgreSQL invariant triggers after Hibernate schema synchronization.
 */
public interface DatabaseTriggerProvider {

    /**
     * Determines whether this provider handles the specified database product.
     *
     * @param databaseProductName the database metadata product name
     * @return true if supported
     */
    boolean supports(String databaseProductName);

    /**
     * Applies database-specific triggers after Hibernate Code-First schema generation.
     *
     * @param jdbcTemplate Spring JdbcTemplate for execution
     */
    void applyTriggers(JdbcTemplate jdbcTemplate);
}
