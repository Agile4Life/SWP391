package com.swp391.scms.scheduling;

import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.scheduling.service.SessionCompletionScheduler;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho {@link SessionCompletionScheduler} (P0-13: sweep phải chạy trong giao dịch Spring thật). */
class SessionCompletionSchedulerTest {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-11-10T17:30:00Z"), ZoneId.of("UTC")); // 2026-11-11 00:30 Asia/Ho_Chi_Minh

    @Test
    void sweepIsAnnotatedTransactionalAndRunsAllModifyingQueriesInsideOneTransaction() throws Exception {
        Method sweepMethod = SessionCompletionScheduler.class.getMethod("sweep");
        assertNotNull(sweepMethod.getAnnotation(Transactional.class), "sweep() must be @Transactional");
        Scheduled scheduled = sweepMethod.getAnnotation(Scheduled.class);
        assertNotNull(scheduled);
        assertEquals("Asia/Ho_Chi_Minh", scheduled.zone());

        ClassSessionRepository sessions = mock(ClassSessionRepository.class);
        SessionBookingRepository bookings = mock(SessionBookingRepository.class);
        ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);

        LocalDate expectedCutoff = LocalDate.of(2026, 11, 11).minusDays(SessionCompletionScheduler.GRACE_DAYS);
        when(bookings.completeHeldBefore(expectedCutoff)).thenAnswer(inv -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            return 2;
        });
        when(enrollments.completeFinishedBefore(expectedCutoff)).thenAnswer(inv -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            return 3;
        });
        when(sessions.completeHeldBefore(eq(expectedCutoff), any(LocalDateTime.class))).thenAnswer(inv -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            return 4;
        });

        RecordingTransactionManager txManager = new RecordingTransactionManager();
        SessionCompletionScheduler target = new SessionCompletionScheduler(sessions, bookings, enrollments, CLOCK);
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.addAdvice(new TransactionInterceptor(txManager, new AnnotationTransactionAttributeSource()));
        SessionCompletionScheduler proxied = (SessionCompletionScheduler) proxyFactory.getProxy();

        proxied.sweep();

        assertEquals(1, txManager.begins);
        assertEquals(1, txManager.commits);
        assertEquals(0, txManager.rollbacks);
        verify(bookings).completeHeldBefore(expectedCutoff);
        verify(enrollments).completeFinishedBefore(expectedCutoff);
        verify(sessions).completeHeldBefore(eq(expectedCutoff), any(LocalDateTime.class));
    }

    @Test
    void sweepRollsBackAtomicallyWhenLaterUpdateFails() {
        ClassSessionRepository sessions = mock(ClassSessionRepository.class);
        SessionBookingRepository bookings = mock(SessionBookingRepository.class);
        ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);

        when(bookings.completeHeldBefore(any())).thenReturn(1);
        when(enrollments.completeFinishedBefore(any())).thenThrow(new IllegalStateException("db failure"));

        RecordingTransactionManager txManager = new RecordingTransactionManager();
        SessionCompletionScheduler target = new SessionCompletionScheduler(sessions, bookings, enrollments, CLOCK);
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.addAdvice(new TransactionInterceptor(txManager, new AnnotationTransactionAttributeSource()));
        SessionCompletionScheduler proxied = (SessionCompletionScheduler) proxyFactory.getProxy();

        assertThrows(IllegalStateException.class, proxied::sweep);
        assertEquals(1, txManager.begins);
        assertEquals(0, txManager.commits);
        assertEquals(1, txManager.rollbacks);
        verify(sessions, never()).completeHeldBefore(any(), any());
    }

    private static final class RecordingTransactionManager extends AbstractPlatformTransactionManager {
        int begins;
        int commits;
        int rollbacks;

        @Override protected Object doGetTransaction() { return new Object(); }
        @Override protected void doBegin(Object transaction, TransactionDefinition definition) { begins++; }
        @Override protected void doCommit(DefaultTransactionStatus status) { commits++; }
        @Override protected void doRollback(DefaultTransactionStatus status) { rollbacks++; }
    }
}
