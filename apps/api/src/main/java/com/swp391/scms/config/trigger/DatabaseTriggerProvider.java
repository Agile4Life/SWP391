package com.swp391.scms.config.trigger;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Giao diện cho lớp cài trigger nghiệp vụ bắt buộc sau khi Hibernate đồng bộ schema. Hiện chỉ có bản
 * PostgreSQL.
 *
 * Cài các trigger bất biến bắt buộc của PostgreSQL sau khi Hibernate đồng bộ schema.
 */
public interface DatabaseTriggerProvider {

    /**
     * Cho biết provider này có hỗ trợ loại database (tên lấy từ JDBC metadata) hay không.
     *
     * Xác định provider này có xử lý loại database đã cho không.
     *
     * @param databaseProductName tên sản phẩm database lấy từ metadata
     * @return true nếu được hỗ trợ
     */
    boolean supports(String databaseProductName);

    /**
     * Cài các trigger vào database qua JdbcTemplate.
     *
     * Áp dụng các trigger đặc thù database sau khi Hibernate sinh schema code-first.
     *
     * @param jdbcTemplate Spring JdbcTemplate dùng để thực thi
     */
    void applyTriggers(JdbcTemplate jdbcTemplate);
}
