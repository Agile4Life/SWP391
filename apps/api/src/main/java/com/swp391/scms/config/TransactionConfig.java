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

@Configuration(proxyBeanMethods = false)
@EnableTransactionManagement(order = Ordered.LOWEST_PRECEDENCE - 1)
public class TransactionConfig {

    /**
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
