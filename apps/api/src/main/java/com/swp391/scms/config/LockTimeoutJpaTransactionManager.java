package com.swp391.scms.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.Session;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.TransactionDefinition;

import java.sql.Statement;

/**
 * Starts each read-write transaction with {@code SET LOCAL lock_timeout}. A pessimistic lock ({@code FOR UPDATE})
 * blocked longer than that fails with SQLState 55P03, mapped to HTTP 409 "busy, try again", instead of holding the
 * request (and a pooled connection) open indefinitely.
 *
 * <p>{@code SET LOCAL} only lasts until commit/rollback, so it is safe behind a transaction pooler and leaves no
 * setting on the shared connection.
 */
public class LockTimeoutJpaTransactionManager extends JpaTransactionManager {
    private final long lockTimeoutMs;

    public LockTimeoutJpaTransactionManager(EntityManagerFactory emf, long lockTimeoutMs) {
        super(emf);
        this.lockTimeoutMs = lockTimeoutMs;
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {
        super.doBegin(transaction, definition);
        if (lockTimeoutMs <= 0 || definition.isReadOnly()) return;
        EntityManager em = EntityManagerFactoryUtils.getTransactionalEntityManager(obtainEntityManagerFactory());
        if (em == null) return;
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement statement = connection.createStatement()) {
                statement.execute("SET LOCAL lock_timeout = '" + lockTimeoutMs + "ms'");
            }
        });
    }
}
