package com.swp391.scms.scheduling;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.scheduling.service.EnrollmentService.CourseHoldOutcome;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.wallet.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** A membership hold gives a course credit or fee back only when approved 3+ days before the course starts. */
class CourseHoldRefundTest {

    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final WalletService wallets = mock(WalletService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final LocalDate today = LocalDate.of(2026, 11, 9);

    private EnrollmentService service;
    private Member member;

    @BeforeEach
    void setUp() {
        service = new EnrollmentService(enrollments, null, gymClasses,
                mock(MembershipSubscriptionRepository.class), members, null, null, clock);
        service.setPaymentRepository(payments);
        ReflectionTestUtils.setField(service, "wallets", wallets);
        member = new Member();
        member.setUserId(100L);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));
    }

    private ClassEnrollment enroll(long id, LocalDate courseStart) {
        GymClass gymClass = new GymClass();
        gymClass.setId(id);
        gymClass.setName("Course " + id);
        gymClass.setStartDate(courseStart);
        gymClass.setEndDate(courseStart.plusDays(30));
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(id * 10);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(gymClasses.findByIdForUpdate(id)).thenReturn(Optional.of(gymClass));
        when(enrollments.findBookedClassIdsByMemberId(100L)).thenReturn(List.of(id));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(id, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenAnswer(inv -> inv.getArgument(0));
        return enrollment;
    }

    private Payment paid(long enrollmentId, String amount) {
        Payment payment = new Payment();
        payment.setId(enrollmentId + 1);
        payment.setClassEnrollmentId(enrollmentId);
        payment.setAmount(new BigDecimal(amount));
        payment.setStatus("success");
        when(payments.findByClassEnrollmentId(enrollmentId)).thenReturn(Optional.of(payment));
        return payment;
    }

    @Test
    void freeCreditIsRestoredWhenTheHoldIsApprovedThreeDaysBeforeTheCourse() {
        ClassEnrollment enrollment = enroll(1L, today.plusDays(3));

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(1, outcome.cancelled());
        assertEquals(1, outcome.creditsRestored());
        assertEquals(0, outcome.creditsLost());
        assertEquals("cancelled", enrollment.getStatus());
        assertFalse(enrollment.isCreditForfeited());
    }

    @Test
    void freeCreditIsLostWhenTheCourseStartsInUnderThreeDays() {
        ClassEnrollment enrollment = enroll(1L, today.plusDays(2));

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(1, outcome.cancelled());
        assertEquals(0, outcome.creditsRestored());
        assertEquals(1, outcome.creditsLost());
        assertEquals("cancelled", enrollment.getStatus());
        assertTrue(enrollment.isCreditForfeited());
    }

    @Test
    void freeCreditIsLostWhenTheCourseIsAlreadyRunning() {
        ClassEnrollment enrollment = enroll(1L, today.minusDays(5));

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(1, outcome.creditsLost());
        assertTrue(enrollment.isCreditForfeited());
    }

    @Test
    void paidFeeIsRefundedInFullToTheWalletWhenInTime() {
        ClassEnrollment enrollment = enroll(1L, today.plusDays(10));
        Payment payment = paid(enrollment.getId(), "500000");

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(0, new BigDecimal("500000").compareTo(outcome.refunded()));
        assertEquals("refunded", payment.getStatus());
        verify(wallets).creditCourseRefund(eq(100L), eq(new BigDecimal("500000")),
                eq("COURSE_REFUND_" + enrollment.getId()), any());
        assertFalse(enrollment.isCreditForfeited());
    }

    @Test
    void paidFeeIsNotRefundedWhenTheHoldIsTooLate() {
        ClassEnrollment enrollment = enroll(1L, today.plusDays(1));
        Payment payment = paid(enrollment.getId(), "500000");

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(1, outcome.cancelled());
        assertEquals(1, outcome.creditsLost());
        assertEquals(0, BigDecimal.ZERO.compareTo(outcome.refunded()));
        assertEquals("success", payment.getStatus());
        verifyNoInteractions(wallets);
        assertEquals("cancelled", enrollment.getStatus());
    }

    @Test
    void unpaidFeeIsClosedWithoutAnyRefund() {
        ClassEnrollment enrollment = enroll(1L, today.plusDays(10));
        Payment payment = paid(enrollment.getId(), "500000");
        payment.setStatus("pending");

        CourseHoldOutcome outcome = service.releaseCoursesForHold(100L, "hold", null, null);

        assertEquals(1, outcome.cancelled());
        assertEquals("failed", payment.getStatus());
        verifyNoInteractions(wallets);
    }

    @Test
    void aDatedHoldOnlyAffectsCoursesWithASessionInsideItsWindow() {
        var sessions = mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        service = new EnrollmentService(enrollments, sessions, gymClasses,
                mock(MembershipSubscriptionRepository.class), members, null, null, clock);
        service.setPaymentRepository(payments);
        ReflectionTestUtils.setField(service, "wallets", wallets);
        ClassEnrollment enrollment = enroll(1L, today.plusDays(10));
        com.swp391.scms.scheduling.entity.ClassSession session = new com.swp391.scms.scheduling.entity.ClassSession();
        session.setSessionDate(today.plusDays(20));
        session.setStatus("scheduled");
        when(sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(1L)).thenReturn(List.of(session));

        CourseHoldOutcome outside = service.releaseCoursesForHold(100L, "hold", today.plusDays(10), today.plusDays(15));
        assertEquals(0, outside.cancelled());
        assertEquals("booked", enrollment.getStatus());

        CourseHoldOutcome overlapping = service.releaseCoursesForHold(100L, "hold", today.plusDays(18), today.plusDays(25));
        assertEquals(1, overlapping.cancelled());
        assertEquals(1, overlapping.creditsRestored());
        assertEquals("cancelled", enrollment.getStatus());
    }
}
