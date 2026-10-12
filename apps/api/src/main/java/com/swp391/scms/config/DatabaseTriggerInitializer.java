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
 * Initializes invariant business database triggers after Hibernate Code-First
 * schema generation has completed, dispatching polymorphically to providers.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseTriggerInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTriggerInitializer.class);

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final List<DatabaseTriggerProvider> triggerProviders;

    public DatabaseTriggerInitializer(DataSource dataSource,
                                      JdbcTemplate jdbcTemplate,
                                      List<DatabaseTriggerProvider> triggerProviders) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.triggerProviders = triggerProviders;
    }

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
        log.info("Database {} does not require vendor-specific invariant triggers.", dbProduct);
    }
}
