package com.swp391.scms.scheduling;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.PaymentService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.CourseCheckoutDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CoursePaymentTest {

    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private MemberRepository members = mock(MemberRepository.class);
    private PaymentRepository paymentRepository = mock(PaymentRepository.class);
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private EnrollmentService enrollmentService;

    @BeforeEach
    void setUp() {
        enrollmentService = new EnrollmentService(
                enrollments,
                null,
                gymClasses,
                subscriptions,
                members,
                null,
                null,
                clock
        );
        enrollmentService.setPaymentRepository(paymentRepository);
    }

    @Test
    void testCheckoutCreatesPendingPaymentWhenQuotaExceeded() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);

        when(members.findById(100L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class))).thenReturn(true);

        // Already 2 booked courses -> quota exceeded
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(eq(100L), eq("booked"), any(), any()))
                .thenReturn(2L);

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Yoga Advanced");
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 12, 20));
        gymClass.setCapacity(20);
        gymClass.setPrice(new BigDecimal("500000.00"));

        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(5L);

        ClassEnrollment savedEnrollment = new ClassEnrollment();
        savedEnrollment.setId(777L);
        savedEnrollment.setGymClass(gymClass);
        savedEnrollment.setMember(member);
        savedEnrollment.setStatus("booked");
        when(enrollments.save(any(ClassEnrollment.class))).thenReturn(savedEnrollment);

        Payment savedPayment = new Payment();
        savedPayment.setId(888L);
        savedPayment.setMember(member);
        savedPayment.setClassEnrollmentId(777L);
        savedPayment.setAmount(new BigDecimal("500000.00"));
        savedPayment.setMethod("cash");
        savedPayment.setStatus("pending");
        when(paymentRepository.save(any(Payment.class))).thenReturn(savedPayment);

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "cash");

        assertNotNull(result);
        assertEquals(777L, result.enrollmentId());
        assertEquals(888L, result.paymentId());
        assertEquals(new BigDecimal("500000.00"), result.amount());
        assertEquals("cash", result.paymentMethod());
        assertEquals("pending", result.paymentStatus());

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment captured = captor.getValue();
        assertEquals(new BigDecimal("500000.00"), captured.getAmount());
        assertEquals("cash", captured.getMethod());
        assertEquals(777L, captured.getClassEnrollmentId());
    }

    @Test
    void testCancelBeforeStartFailsThePendingCoursePayment() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Yoga Advanced");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(777L);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.save(any(ClassEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Payment pending = new Payment();
        pending.setId(888L);
        pending.setClassEnrollmentId(777L);
        pending.setStatus("pending");
        when(paymentRepository.findByClassEnrollmentId(777L)).thenReturn(Optional.of(pending));

        enrollmentService.cancelCourseEnrollment(principal, 50L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("failed", pending.getStatus());
        verify(paymentRepository).save(pending);
    }

    @Test
    void testCancelKeepsASettledCoursePaymentForTheRefundFlow() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(777L);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.save(any(ClassEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Payment paid = new Payment();
        paid.setId(888L);
        paid.setClassEnrollmentId(777L);
        paid.setStatus("success");
        when(paymentRepository.findByClassEnrollmentId(777L)).thenReturn(Optional.of(paid));

        enrollmentService.cancelCourseEnrollment(principal, 50L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("success", paid.getStatus());
        verify(paymentRepository, never()).save(any(Payment.class));
    }
}
