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
                "membership_packages", "payments", "classes", "class_sessions",
                "coach_bookings", "members")) {
            when(point.getArgs()).thenReturn(new Object[]{1L});
            aspect.around(point, audited("TEST_" + entity, entity));
        }
        when(point.getArgs()).thenReturn(new Object[]{1L, 2L});
        aspect.around(point, audited("TEST_ROLE_PERM", "role_permissions"));

        verify(entityManager, org.mockito.Mockito.never()).find(any(), any(), any(jakarta.persistence.LockModeType.class));
    }

    /** Kiểm thử P1-BE-35: không bao giờ serialize AuthTokenResponse (JWT) vào audit_logs.new_value. */
    @Test
    void passwordChangeNeverSerializesJwtAuthTokenResponse() throws Throwable {
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        when(point.getArgs()).thenReturn(new Object[]{42L, "oldPass", "newPass"});
        var authToken = new com.swp391.scms.auth.dto.AuthTokenResponse(
                "eyJhbGciOiJIUzI1NiJ9.super-secret-jwt.sig", "member1", "MEMBER", "Member One");
        when(point.proceed()).thenReturn(authToken);

        new AuditAspect(repository, new ObjectMapper())
                .around(point, audited("PASSWORD_CHANGE", "users"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog entry = captor.getValue();
        assertEquals(42L, entry.getEntityId());
        assertNull(entry.getNewValue());
    }

    /** Kiểm thử P1-BE-35: điểm danh PT bỏ qua AuthenticatedPrincipal, chụp coach_bookings không PII/avatarUrl. */
    @Test
    void ptAttendanceCapturesNonPiiCoachBookingSnapshotAndSkipsLeadingPrincipal() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var principal = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
        var booking = new com.swp391.scms.coaching.entity.CoachBooking();
        booking.setId(55L);
        var member = new com.swp391.scms.users.entity.Member();
        member.setUserId(10L);
        var coach = new com.swp391.scms.users.entity.Coach();
        coach.setUserId(20L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setStatus("confirmed");
        booking.setAttendanceLocked(false);

        var dtoWithPii = new com.swp391.scms.coaching.dto.CoachBookingDto(
                55L, 10L, "Nguyen Van A", 20L, "Coach B", "Gym", "data:image/png;base64,SENSITIVE_AVATAR",
                null, null,
                java.time.LocalDate.of(2026, 11, 20), java.time.LocalTime.of(9, 45), java.time.LocalTime.of(11, 15),
                java.math.BigDecimal.valueOf(200000), "package_quota", "used_quota", "confirmed",
                null, null, null, null,
                java.time.LocalDateTime.of(2026, 11, 20, 9, 50), false, null,
                "MEM-001", "0901234567", "secret@email.com");

        when(point.getArgs()).thenReturn(new Object[]{principal, 55L});
        when(entityManager.find(com.swp391.scms.coaching.entity.CoachBooking.class, 55L)).thenReturn(booking);
        when(point.proceed()).thenAnswer(inv -> {
            booking.setAttendedAt(java.time.LocalDateTime.of(2026, 11, 20, 9, 50));
            return dtoWithPii;
        });

        new AuditAspect(repository, new ObjectMapper().findAndRegisterModules(), entityManager)
                .around(point, audited("PT_ATTENDANCE_MARK", "coach_bookings"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog entry = captor.getValue();
        assertEquals(55L, entry.getEntityId());
        var oldJson = new ObjectMapper().readTree(entry.getOldValue());
        var newJson = new ObjectMapper().readTree(entry.getNewValue());
        assertEquals(10L, oldJson.get("memberId").asLong());
        assertEquals(20L, oldJson.get("coachId").asLong());
        org.junit.jupiter.api.Assertions.assertTrue(oldJson.get("attendedAt").isNull());
        assertEquals("2026-11-20T09:50", newJson.get("attendedAt").asText());
        assertEquals(false, newJson.get("attendanceLocked").asBoolean());
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("secret@email.com"));
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("0901234567"));
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("SENSITIVE_AVATAR"));
    }

    /** Kiểm thử P1-BE-35: khi không có EntityManager, CoachBookingDto vẫn bị chặn serialize PII. */
    @Test
    void ptAttendanceSuppressesCoachBookingDtoFallbackWhenEntityManagerAbsent() throws Throwable {
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var principal = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
        var dtoWithPii = new com.swp391.scms.coaching.dto.CoachBookingDto(
                55L, 10L, "Nguyen Van A", 20L, "Coach B", "Gym", "data:image/png;base64,SENSITIVE_AVATAR",
                null, null,
                java.time.LocalDate.of(2026, 11, 20), java.time.LocalTime.of(9, 45), java.time.LocalTime.of(11, 15),
                java.math.BigDecimal.valueOf(200000), "package_quota", "used_quota", "confirmed",
                null, null, null, null,
                null, true, null,
                "MEM-001", "0901234567", "secret@email.com");
        when(point.getArgs()).thenReturn(new Object[]{principal, 55L});
        when(point.proceed()).thenReturn(dtoWithPii);

        new AuditAspect(repository, new ObjectMapper().findAndRegisterModules())
                .around(point, audited("PT_ATTENDANCE_UNMARK", "coach_bookings"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertEquals(55L, captor.getValue().getEntityId());
        assertNull(captor.getValue().getNewValue());
    }

    /** Kiểm thử P1-BE-35: snapshot payments bao gồm refundedAmount khi hoàn tiền một phần. */
    @Test
    void paymentSnapshotIncludesRefundedAmount() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var payment = new com.swp391.scms.finance.entity.Payment();
        payment.setId(91L);
        payment.setAmount(new java.math.BigDecimal("500000.00"));
        payment.setRefundedAmount(null);
        payment.setMethod("cash");
        payment.setStatus("success");
        when(point.getArgs()).thenReturn(new Object[]{91L, "refundReq"});
        when(entityManager.find(com.swp391.scms.finance.entity.Payment.class, 91L)).thenReturn(payment);
        when(point.proceed()).thenAnswer(inv -> {
            payment.setRefundedAmount(new java.math.BigDecimal("200000.00"));
            return null;
        });

        new AuditAspect(repository, new ObjectMapper(), entityManager)
                .around(point, audited("PAYMENT_REFUND", "payments"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        var oldJson = new ObjectMapper().readTree(captor.getValue().getOldValue());
        var newJson = new ObjectMapper().readTree(captor.getValue().getNewValue());
        org.junit.jupiter.api.Assertions.assertTrue(oldJson.get("refundedAmount").isNull());
        assertEquals(0, new java.math.BigDecimal("200000.00").compareTo(newJson.get("refundedAmount").decimalValue()));
    }

    /** Kiểm thử P1-BE-36: duyệt KYC bỏ qua AuthenticatedPrincipal và ghi đúng entityId + snapshot members phi-PII. */
    @Test
    void memberKycApproveRecordsMemberIdAndSafeMemberSnapshot() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var reviewer = new AuthenticatedPrincipal(3L, "desk", "RECEPTIONIST");
        var member = new com.swp391.scms.users.entity.Member();
        member.setUserId(77L);
        member.setKycStatus("PENDING");
        member.setIdentityVerified(false);
        member.setCitizenId("012345678901");
        member.setFrontImageUrl("data:image/jpeg;base64,SENSITIVE_ID_CARD");
        when(point.getArgs()).thenReturn(new Object[]{reviewer, 77L});
        when(entityManager.find(com.swp391.scms.users.entity.Member.class, 77L)).thenReturn(member);
        when(point.proceed()).thenAnswer(inv -> {
            member.setKycStatus("APPROVED");
            member.setIdentityVerified(true);
            return null;
        });

        new AuditAspect(repository, new ObjectMapper(), entityManager)
                .around(point, audited("MEMBER_KYC_APPROVE", "members"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog entry = captor.getValue();
        assertEquals(77L, entry.getEntityId());
        var oldJson = new ObjectMapper().readTree(entry.getOldValue());
        var newJson = new ObjectMapper().readTree(entry.getNewValue());
        assertEquals("PENDING", oldJson.get("kycStatus").asText());
        assertEquals(false, oldJson.get("identityVerified").asBoolean());
        assertEquals("APPROVED", newJson.get("kycStatus").asText());
        assertEquals(true, newJson.get("identityVerified").asBoolean());
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("012345678901"));
        org.junit.jupiter.api.Assertions.assertFalse(entry.getNewValue().contains("SENSITIVE_ID_CARD"));
    }

    /** Kiểm thử P1-BE-36: SESSION_CREATE không truy vấn ClassSession theo classId (args[0]) và lấy entityId từ kết quả. */
    @Test
    void sessionCreateNeverSnapshotsClassIdAndUsesCreatedSessionIdFromResult() throws Throwable {
        var entityManager = mock(jakarta.persistence.EntityManager.class);
        var point = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var createdSession = new com.swp391.scms.scheduling.entity.ClassSession();
        createdSession.setId(99L);
        createdSession.setStatus("scheduled");
        createdSession.setSessionDate(java.time.LocalDate.of(2026, 12, 1));
        when(point.getArgs()).thenReturn(new Object[]{5L, "createSessionReq"});
        when(point.proceed()).thenReturn(Map.of("id", 99L, "classId", 5L, "status", "scheduled"));
        when(entityManager.find(com.swp391.scms.scheduling.entity.ClassSession.class, 99L)).thenReturn(createdSession);

        new AuditAspect(repository, new ObjectMapper(), entityManager)
                .around(point, audited("SESSION_CREATE", "class_sessions"));

        verify(entityManager, org.mockito.Mockito.never())
                .find(com.swp391.scms.scheduling.entity.ClassSession.class, 5L);
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog entry = captor.getValue();
        assertEquals(99L, entry.getEntityId());
        assertNull(entry.getOldValue());
        assertEquals(99L, new ObjectMapper().readTree(entry.getNewValue()).get("id").asLong());
    }

    /** Kiểm thử P3-BE-17: địa chỉ IP dài quá 45 ký tự được cắt gọn về đúng 45 ký tự. */
    @Test
    void currentIpIsTruncatedTo45Characters() {
        var request = new org.springframework.mock.web.MockHttpServletRequest();
        String overlongIp = "2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra:chars:12345";
        request.setRemoteAddr(overlongIp);
        org.springframework.web.context.request.RequestContextHolder.setRequestAttributes(
                new org.springframework.web.context.request.ServletRequestAttributes(request));
        try {
            when(joinPoint.getArgs()).thenReturn(new Object[]{42L});
            new AuditAspect(repository, new ObjectMapper())
                    .record(joinPoint, audited("USER_UPDATE", "users"), Map.of("id", 42));

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repository).save(captor.capture());
            assertEquals(45, captor.getValue().getIpAddress().length());
            assertEquals(overlongIp.substring(0, 45), captor.getValue().getIpAddress());
        } finally {
            org.springframework.web.context.request.RequestContextHolder.resetRequestAttributes();
        }
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
