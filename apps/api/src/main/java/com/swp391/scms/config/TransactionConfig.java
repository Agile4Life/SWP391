package com.swp391.scms.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.transaction.TransactionManagerCustomizers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Cấu hình transaction: bật @Transactional và thay trình quản lý transaction mặc định bằng bản có giới hạn thời
 * gian chờ khóa.
 */
@Configuration(proxyBeanMethods = false)
@EnableTransactionManagement(order = Ordered.LOWEST_PRECEDENCE - 1)
public class TransactionConfig {

    /**
     * Thay trình quản lý transaction mặc định của Spring Boot bằng LockTimeoutJpaTransactionManager: mỗi
     * transaction ghi chỉ chờ khóa dòng tối đa app.db.lock-timeout-ms (mặc định 10 giây) thay vì treo sau một
     * transaction bị kẹt.
     *
     * Replaces Boot's JPA transaction manager so every read-write transaction waits at most
     * {@code app.db.lock-timeout-ms} for a row lock instead of hanging behind a stuck transaction.
     */
    @Bean
    public JpaTransactionManager transactionManager(EntityManagerFactory entityManagerFactory,
                                                    ObjectProvider<TransactionManagerCustomizers> customizers,
                                                    @Value("${app.db.lock-timeout-ms:10000}") long lockTimeoutMs) {
        JpaTransactionManager manager = new LockTimeoutJpaTransactionManager(entityManagerFactory, lockTimeoutMs);
        customizers.ifAvailable(c -> c.customize(manager));
        return manager;
    }
}
