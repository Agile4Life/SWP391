package com.swp391.scms.coaching;

import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.coaching.service.CoachingCompletionScheduler;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CoachingCompletionSchedulerTest {
    @Configuration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class TransactionConfig {}

    @Test
    void scheduledSweepRunsInOneTransactionAndRollsBackIfPlanUpdateFails() {
        var bookings = mock(CoachBookingRepository.class);
        var plans = mock(TrainingPlanRepository.class);
        var transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenAnswer(inv -> new SimpleTransactionStatus());
        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(TransactionConfig.class);
            context.registerBean(CoachBookingRepository.class, () -> bookings);
            context.registerBean(TrainingPlanRepository.class, () -> plans);
            context.registerBean(PlatformTransactionManager.class, () -> transactions);
            context.registerBean(Clock.class, () -> Clock.fixed(Instant.parse("2026-11-23T17:35:00Z"), ZoneOffset.UTC));
            context.registerBean(CoachingCompletionScheduler.class);
            context.refresh();

            var scheduler = context.getBean(CoachingCompletionScheduler.class);
            scheduler.sweep();
            verify(bookings).completeHeldBefore(LocalDate.of(2026, 11, 21));
            verify(plans).completeEndedBefore(eq(LocalDate.of(2026, 11, 24)), any());
            verify(transactions).commit(any());

            when(plans.completeEndedBefore(any(), any())).thenThrow(new IllegalStateException("failure"));
            assertThrows(IllegalStateException.class, scheduler::sweep);
            verify(transactions).rollback(any());
        }
    }
}
