package com.swp391.scms.config;

import com.swp391.scms.config.trigger.DatabaseTriggerProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.SmartLifecycle;
import org.springframework.core.Ordered;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Chạy trong pha SmartLifecycle trước khi Tomcat mở cổng HTTP (ngay sau khi Hibernate tạo/cập nhật bảng):
 * cài các trigger nghiệp vụ bắt buộc (kiểm tra sức chứa, trùng lịch...) vào database. Chỉ hỗ trợ PostgreSQL.
 *
 * Khởi tạo các trigger nghiệp vụ bất biến của database sau khi Hibernate sinh xong schema code-first, chọn
 * provider PostgreSQL.
 */
@Component
public class DatabaseTriggerInitializer implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTriggerInitializer.class);

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final List<DatabaseTriggerProvider> triggerProviders;
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** Nhận DataSource để đọc loại database, JdbcTemplate để chạy SQL và danh sách các provider cài trigger. */
    public DatabaseTriggerInitializer(DataSource dataSource,
                                      JdbcTemplate jdbcTemplate,
                                      List<DatabaseTriggerProvider> triggerProviders) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.triggerProviders = triggerProviders;
    }

    /** Cài đặt trigger trước khi web server mở cổng (phase HIGHEST_PRECEDENCE < WebServerStartStopLifecycle). */
    @Override
    public void start() {
        if (running.compareAndSet(false, true)) {
            try {
                installTriggers();
            } catch (RuntimeException ex) {
                running.set(false);
                throw ex;
            }
        }
    }

    @Override
    public void stop() {
        running.set(false);
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public int getPhase() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    /**
     * Đọc tên sản phẩm database từ metadata, chọn provider hỗ trợ (PostgreSQL) và cài trigger. Không có
     * provider phù hợp thì dừng khởi động, vì thiếu trigger là vi phạm bất biến nghiệp vụ.
     */
    public void run(ApplicationArguments args) {
        installTriggers();
    }

    private void installTriggers() {
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
