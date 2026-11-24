package com.swp391.scms.config;

import com.swp391.scms.config.trigger.DatabaseTriggerProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.List;

/**
 * Chạy ngay khi ứng dụng khởi động xong (sau khi Hibernate tạo/cập nhật bảng): cài các trigger nghiệp vụ bắt
 * buộc (kiểm tra sức chứa, trùng lịch...) vào database. Chỉ hỗ trợ PostgreSQL.
 *
 * Initializes invariant business database triggers after Hibernate Code-First
 * schema generation has completed, selecting the PostgreSQL provider.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseTriggerInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTriggerInitializer.class);

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final List<DatabaseTriggerProvider> triggerProviders;

    /** Nhận DataSource để đọc loại database, JdbcTemplate để chạy SQL và danh sách các provider cài trigger. */
    public DatabaseTriggerInitializer(DataSource dataSource,
                                      JdbcTemplate jdbcTemplate,
                                      List<DatabaseTriggerProvider> triggerProviders) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.triggerProviders = triggerProviders;
    }

    /**
     * Đọc tên sản phẩm database từ metadata, chọn provider hỗ trợ (PostgreSQL) và cài trigger. Không có
     * provider phù hợp thì dừng khởi động, vì thiếu trigger là vi phạm bất biến nghiệp vụ.
     */
    @Override
    public void run(ApplicationArguments args) {
        String dbProduct;
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            dbProduct = metaData.getDatabaseProductName();
        } catch (SQLException e) {
            throw new IllegalStateException("Cannot inspect database to install invariant triggers", e);
        }
        log.info("Detected database product: {}", dbProduct);

        for (DatabaseTriggerProvider provider : triggerProviders) {
            if (provider.supports(dbProduct)) {
                provider.applyTriggers(jdbcTemplate);
                return;
            }
        }
        throw new IllegalStateException("Unsupported database: " + dbProduct + "; PostgreSQL is required");
    }
}
