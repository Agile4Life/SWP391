package com.swp391.scms.coaching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.AuditAspect;
import com.swp391.scms.audit.AuditLog;
import com.swp391.scms.audit.AuditLogRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import java.time.*;
import java.util.Optional;
import org.hibernate.annotations.Check;
import org.junit.jupiter.api.Test;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.SmartTransactionObject;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Entity contract and rollback safety. Real PostgreSQL coverage lives in PtAttendanceIsolatedPostgreSqlTest. */
class PtAttendanceTransactionDiagnosticTest {
    @Test
    void entitySupportsPtAuditAndGenuineAuditFailureStillRollsBack() throws Exception {
        String constraint = AuditLog.class.getAnnotation(Check.class).constraints();
        var annotation = CoachBookingService.class
                .getMethod("unmarkAttended", AuthenticatedPrincipal.class, Long.class)
                .getAnnotation(com.swp391.scms.audit.Audited.class);
        assertEquals("coach_bookings", annotation.entity());
        assertTrue(constraint.contains("'" + annotation.entity() + "'"), "The audit entity must support PT attendance");

        var bookings = mock(CoachBookingRepository.class);
        var audit = mock(AuditLogRepository.class);
        var booking = new CoachBooking();
        booking.setId(11L);
        var member = new Member(); member.setUserId(10L); booking.setMember(member);
        var coach = new Coach(); coach.setUserId(20L); booking.setCoach(coach);
        booking.setBookingDate(LocalDate.of(2026, 10, 30));
        booking.setStartTime(LocalTime.of(9, 0)); booking.setEndTime(LocalTime.of(10, 0));
        booking.setAttendedAt(LocalDateTime.of(2026, 10, 30, 9, 0));
        when(bookings.findById(11L)).thenReturn(Optional.of(booking));
        var manager = new FailedAuditTransactionManager();
        when(audit.save(any())).thenAnswer(invocation -> {
            AuditLog entry = invocation.getArgument(0);
            assertEquals(annotation.entity(), entry.getEntityType());
            // Model PostgreSQL 23514 plus JPA marking the shared transaction rollback-only.
            manager.transaction.rollbackOnly = true;
            throw new DataIntegrityViolationException("ck_audit_entity_type",
                    new java.sql.SQLException("violates check constraint ck_audit_entity_type", "23514"));
        });
        var target = new CoachBookingService(bookings, null, null, null, null, null, null,
                Clock.fixed(Instant.parse("2026-10-31T01:00:00Z"), ZoneOffset.UTC), null);
        var proxy = new AspectJProxyFactory(target);
        proxy.addAspect(new AuditAspect(audit, new ObjectMapper().findAndRegisterModules()));
        proxy.addAdvice(0, new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        CoachBookingService service = proxy.getProxy();
        var mvc = MockMvcBuilders.standaloneSetup(new CoachBookingController(service, null))
                .setCustomArgumentResolvers(new org.springframework.web.method.support.HandlerMethodArgumentResolver() {
                    public boolean supportsParameter(org.springframework.core.MethodParameter parameter) {
                        return parameter.getParameterType() == AuthenticatedPrincipal.class;
                    }
                    public Object resolveArgument(org.springframework.core.MethodParameter parameter,
                            org.springframework.web.method.support.ModelAndViewContainer container,
                            org.springframework.web.context.request.NativeWebRequest request,
                            org.springframework.web.bind.support.WebDataBinderFactory binder) {
                        return new AuthenticatedPrincipal(2L, "mock-desk", "RECEPTIONIST");
                    }
                })
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/v1/coach-bookings/11/unmark-attended"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"));
        assertTrue(manager.rolledBack);
        assertFalse(manager.committed);
        verify(audit).save(any());
    }

    private static final class FailedAuditTransactionManager extends AbstractPlatformTransactionManager {
        final AuditTransaction transaction = new AuditTransaction();
        boolean committed;
        boolean rolledBack;
        @Override protected Object doGetTransaction() { return transaction; }
        @Override protected void doBegin(Object tx, TransactionDefinition definition) { }
        @Override protected void doCommit(DefaultTransactionStatus status) { committed = true; }
        @Override protected void doRollback(DefaultTransactionStatus status) { rolledBack = true; }
    }
    private static final class AuditTransaction implements SmartTransactionObject {
        boolean rollbackOnly;
        @Override public boolean isRollbackOnly() { return rollbackOnly; }
        @Override public void flush() { }
    }
}
