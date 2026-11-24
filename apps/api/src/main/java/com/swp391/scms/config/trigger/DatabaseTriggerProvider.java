package com.swp391.scms.config.trigger;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Giao diện cho lớp cài trigger nghiệp vụ bắt buộc sau khi Hibernate đồng bộ schema. Hiện chỉ có bản
 * PostgreSQL.
 *
 * Installs mandatory PostgreSQL invariant triggers after Hibernate schema synchronization.
 */
public interface DatabaseTriggerProvider {

    /**
     * Cho biết provider này có hỗ trợ loại database (tên lấy từ JDBC metadata) hay không.
     *
     * Determines whether this provider handles the specified database product.
     *
     * @param databaseProductName the database metadata product name
     * @return true if supported
     */
    boolean supports(String databaseProductName);

    /**
     * Cài các trigger vào database qua JdbcTemplate.
     *
     * Applies database-specific triggers after Hibernate Code-First schema generation.
     *
     * @param jdbcTemplate Spring JdbcTemplate for execution
     */
    void applyTriggers(JdbcTemplate jdbcTemplate);
}
