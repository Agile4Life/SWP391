package com.swp391.scms.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.security.AuthenticatedPrincipal;
import java.util.Map;
import org.aspectj.lang.JoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/** Bộ kiểm thử cho AuditAspect (audit aspect). */
@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    /** Kiểm thử: ghi trạng thái user cũ và mới nhưng không có mật khẩu. */
    @Test
    void capturesOldAndNewUserStateWithoutPassword() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var user = new com.swp391.scms.users.entity.User();
        user.setId(42L);
        user.setFullName("Before");
        user.setPasswordHash("secret");
        user.setAvatarUrl("data:image/png;base64,c2Vuc2l0aXZlLWltYWdl");
        when(point.getArgs()).thenReturn(new Object[]{42L});
        when(entityManager.find(com.swp391.scms.users.entity.User.class, 42L)).thenReturn(user);
        when(point.proceed()).thenAnswer(invocation -> { user.setFullName("After"); return null; });

        new AuditAspect(repository, new ObjectMapper(), entityManager)
                .around(point, audited("USER_UPDATE", "users"));

        verify(entityManager, org.mockito.Mockito.never()).find(any(), any(), any(jakarta.persistence.LockModeType.class));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertEquals("Before", new ObjectMapper().readTree(captor.getValue().getOldValue()).get("fullName").asText());
        assertEquals("After", new ObjectMapper().readTree(captor.getValue().getNewValue()).get("fullName").asText());
        org.junit.jupiter.api.Assertions.assertFalse(captor.getValue().getOldValue().contains("secret"));
        org.junit.jupiter.api.Assertions.assertFalse(captor.getValue().getOldValue().contains("c2Vuc2l0aXZlLWltYWdl"));
        org.junit.jupiter.api.Assertions.assertFalse(captor.getValue().getNewValue().contains("c2Vuc2l0aXZlLWltYWdl"));
    }

    /** Kiểm thử: điểm danh lớp ghi ai được đánh dấu gì trước và sau, không kèm thông tin liên hệ. */
    @Test
    @SuppressWarnings("unchecked")
    void classAttendanceLogsWhoWasMarkedWhatBeforeAndAfterWithoutContactDetails() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var query = mock(jakarta.persistence.TypedQuery.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        when(point.getArgs()).thenReturn(new Object[]{100L, null, null});
        when(entityManager.createQuery(any(String.class), org.mockito.ArgumentMatchers.eq(Object[].class))).thenReturn(query);
        when(query.setParameter("id", 100L)).thenReturn(query);
        when(query.getResultList())
                .thenReturn(java.util.List.<Object[]>of(new Object[]{20L, "present"}))
                .thenReturn(java.util.List.<Object[]>of(new Object[]{20L, "absent"}));
        when(point.proceed()).thenReturn(java.util.List.of(Map.of("email", "jane@test.com", "phone", "0900000000")));

        new AuditAspect(repository, new ObjectMapper(), entityManager)
                .around(point, audited("CLASS_ATTENDANCE_RECORD", "session_attendance"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog entry = captor.getValue();
        assertEquals(100L, entry.getEntityId());
        assertEquals("present", new ObjectMapper().readTree(entry.getOldValue()).get("records").get("20").asText());
        assertEquals("absent", new ObjectMapper().readTree(entry.getNewValue()).get("records").get("20").asText());
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("jane@test.com"));
    }

    @Mock AuditLogRepository repository;
    @Mock JoinPoint joinPoint;

    /** Dọn dẹp sau mỗi test: xóa SecurityContext. */
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    /** Hàm trợ giúp của test: phương thức mẫu gắn @Audited. */
    private Audited audited(String action, String entity) {
        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn(action);
        when(audited.entity()).thenReturn(entity);
        return audited;
    }

    /** Kiểm thử: ghi actor, id thực thể từ đối số đầu và JSON kết quả. */
    @Test
    void recordsActorEntityIdFromFirstArgAndResultJson() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(7L, "boss", "CENTER_MANAGER"), null));
        when(joinPoint.getArgs()).thenReturn(new Object[]{42L, "ignored"});
        AuditAspect aspect = new AuditAspect(repository, new ObjectMapper());

        aspect.record(joinPoint, audited("USER_UPDATE", "users"), Map.of("id", 42, "status", "locked"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog log = captor.getValue();
        assertEquals(7L, log.getUserId());
        assertEquals(42L, log.getEntityId());
        assertEquals("USER_UPDATE", log.getAction());
        assertEquals("users", log.getEntityType());
        assertEquals(true, log.getNewValue().contains("locked"));
    }

    /** Kiểm thử: lấy id thực thể từ kết quả khi đối số đầu không phải id. */
    @Test
    void takesEntityIdFromResultWhenFirstArgIsNotAnId() {
        when(joinPoint.getArgs()).thenReturn(new Object[]{"dto"});
        AuditAspect aspect = new AuditAspect(repository, new ObjectMapper());

        aspect.record(joinPoint, audited("USER_CREATE", "users"), Map.of("id", 5));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertEquals(5L, captor.getValue().getEntityId());
        assertNull(captor.getValue().getUserId());
    }

    /** Kiểm thử: lỗi repository không bao giờ làm hỏng nghiệp vụ chính. */
    @Test
    void repositoryFailureNeverBreaksTheBusinessCall() {
        when(joinPoint.getArgs()).thenReturn(new Object[]{1L});
        when(repository.save(any())).thenThrow(new IllegalStateException("db down"));
        AuditAspect aspect = new AuditAspect(repository, new ObjectMapper());

        aspect.record(joinPoint, audited("USER_DELETE", "users"), null);
    }

    /** Kiểm thử P0-15: snapshot không bao giờ lấy khóa PESSIMISTIC_WRITE cho mọi entity được hỗ trợ. */
    @Test
    void snapshotsNeverAcquirePessimisticWriteLockForAnyEntity() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        when(point.proceed()).thenReturn(Map.of("id", 1L));

        AuditAspect aspect = new AuditAspect(repository, new ObjectMapper(), entityManager);

        for (String entity : java.util.List.of(
                "users", "coaches", "receptionists", "support_requests",
                "membership_packages", "payments", "classes", "class_sessions")) {
            when(point.getArgs()).thenReturn(new Object[]{1L});
            aspect.around(point, audited("TEST_" + entity, entity));
        }
        when(point.getArgs()).thenReturn(new Object[]{1L, 2L});
        aspect.around(point, audited("TEST_ROLE_PERM", "role_permissions"));

        verify(entityManager, org.mockito.Mockito.never()).find(any(), any(), any(jakarta.persistence.LockModeType.class));
    }

    /** Kiểm thử P0-15: AuditLogWriter.save chạy trong giao dịch REQUIRES_NEW và AuditAspect chỉ ghi sau commit. */
    @Test
    void defersAuditPersistenceToAfterCommitViaAuditLogWriterAndSwallowsPostCommitFailure() throws Throwable {
        var txAnnotation = AuditLogWriter.class.getMethod("save", AuditLog.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        org.junit.jupiter.api.Assertions.assertNotNull(txAnnotation);
        assertEquals(org.springframework.transaction.annotation.Propagation.REQUIRES_NEW, txAnnotation.propagation());

        AuditLogWriter writer = mock(AuditLogWriter.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("audit constraint failed"))
                .when(writer).save(any(AuditLog.class));

        var txManager = new org.springframework.transaction.support.AbstractPlatformTransactionManager() {
            @Override protected Object doGetTransaction() { return new Object(); }
            @Override protected void doBegin(Object transaction, org.springframework.transaction.TransactionDefinition definition) { }
            @Override protected void doCommit(org.springframework.transaction.support.DefaultTransactionStatus status) { }
            @Override protected void doRollback(org.springframework.transaction.support.DefaultTransactionStatus status) { }
        };

        SampleAuditedTarget target = new SampleAuditedTarget();
        var proxyFactory = new org.springframework.aop.aspectj.annotation.AspectJProxyFactory(target);
        proxyFactory.addAspect(new AuditAspect(repository, new ObjectMapper(), null, writer));
        proxyFactory.addAdvice(0, new org.springframework.transaction.interceptor.TransactionInterceptor(
                txManager, new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        SampleAuditedTarget proxied = proxyFactory.getProxy();

        // 1. Thành công: ghi sau commit qua AuditLogWriter (không ghi trực tiếp vào repository trong TX chính);
        // lỗi của AuditLogWriter sau commit không làm gãy kết quả đã commit.
        String result = proxied.succeed(99L);
        assertEquals("ok-99", result);
        verify(writer).save(any(AuditLog.class));
        verify(repository, org.mockito.Mockito.never()).save(any());

        // 2. Rollback: không ghi bản ghi audit nào cho thao tác thất bại.
        org.mockito.Mockito.reset(writer);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () -> proxied.fail(99L));
        verify(writer, org.mockito.Mockito.never()).save(any());
    }

    /** Kiểm thử P0-15: ngoài giao dịch, AuditAspect gọi AuditLogWriter trực tiếp và không ném lỗi ra ngoài. */
    @Test
    void writesViaAuditLogWriterDirectlyWhenOutsideTransaction() {
        AuditLogWriter writer = mock(AuditLogWriter.class);
        when(joinPoint.getArgs()).thenReturn(new Object[]{15L});
        AuditAspect aspect = new AuditAspect(repository, new ObjectMapper(), null, writer);

        aspect.record(joinPoint, audited("USER_UPDATE", "users"), Map.of("id", 15));

        verify(writer).save(any(AuditLog.class));
        verify(repository, org.mockito.Mockito.never()).save(any());
    }

    static class SampleAuditedTarget {
        @org.springframework.transaction.annotation.Transactional
        @Audited(action = "USER_UPDATE", entity = "users")
        public String succeed(Long id) {
            return "ok-" + id;
        }

        @org.springframework.transaction.annotation.Transactional
        @Audited(action = "USER_UPDATE", entity = "users")
        public String fail(Long id) {
            throw new IllegalStateException("business failure");
        }
    }
}
