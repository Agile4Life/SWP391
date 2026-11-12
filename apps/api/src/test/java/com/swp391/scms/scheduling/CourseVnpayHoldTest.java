package com.swp391.scms.scheduling;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.entity.VnpayTransaction;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.repository.VnpayTransactionRepository;
import com.swp391.scms.finance.service.VnpayPaymentGuard;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A course fee VNPay may still settle keeps its seat: neither a cancellation nor the unpaid-fee sweep releases it. */
class CourseVnpayHoldTest {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    // 15:00 in the center's time zone.
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZONE);
    private final LocalDateTime now = LocalDateTime.of(2026, 11, 9, 15, 0);

    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final VnpayTransactionRepository transactions = mock(VnpayTransactionRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AuthenticatedPrincipal member = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");

    private EnrollmentService service;
    private ClassEnrollment enrollment;
    private Payment fee;

    @BeforeEach
    void setUp() {
        service = new EnrollmentService(enrollments, null, gymClasses, null, members, notifications, null, clock);
        service.setPaymentRepository(payments);
        service.setVnpayGuard(new VnpayPaymentGuard(transactions, payments, clock));

        Member owner = new Member();
        owner.setUserId(100L);
        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        enrollment = new ClassEnrollment();
        enrollment.setId(9L);
        enrollment.setMember(owner);
        enrollment.setGymClass(gymClass);
        enrollment.setStatus("booked");

        fee = new Payment();
        fee.setId(77L);
        fee.setClassEnrollmentId(9L);
        fee.setAmount(new BigDecimal("500000"));
        fee.setMethod("online_wallet");
        fee.setStatus("pending");
        fee.setCreatedAt(now.minusMinutes(20));

        when(enrollments.findClassIdById(9L)).thenReturn(Optional.of(50L));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByIdForUpdate(9L)).thenReturn(Optional.of(enrollment));
        when(enrollments.findById(9L)).thenReturn(Optional.of(enrollment));
        when(enrollments.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(fee));
        when(payments.findPendingCourseFeesCreatedBefore(any())).thenReturn(List.of(fee));
    }

    private VnpayTransaction attemptExpiringAt(LocalDateTime expiresAt) {
        VnpayTransaction attempt = new VnpayTransaction("REF1", fee, fee.getAmount(), expiresAt.minusMinutes(15), expiresAt, "127.0.0.1");
        when(transactions.findAllByPaymentId(77L)).thenReturn(List.of(attempt));
        when(transactions.existsByPaymentIdAndStatus(eq(77L), eq("pending")))
                .thenAnswer(inv -> "pending".equals(attempt.getStatus()));
        return attempt;
    }

    @Test
    void aMemberCannotCancelWhileVnpayMayStillConfirmTheFee() {
        attemptExpiringAt(now.plusMinutes(5));

        ConflictException ex = assertThrows(ConflictException.class, () -> service.cancel(member, 9L));

        assertEquals("VNPAY_AWAITING_CONFIRMATION", ex.getErrorCode());
        assertEquals("booked", enrollment.getStatus());
        assertEquals("pending", fee.getStatus());
    }

    @Test
    void theUnpaidSweepKeepsASeatWhoseFeeIsInsideTheGatewayGracePeriod() {
        // Past the 15-minute hold and the gateway expiry, but still inside the IPN grace period.
        attemptExpiringAt(now.minusMinutes(5));

        assertEquals(0, service.expireUnpaidCourseEnrollments());

        assertEquals("booked", enrollment.getStatus());
        assertEquals("pending", fee.getStatus());
    }

    @Test
    void theUnpaidSweepReleasesTheSeatOnceTheAttemptCanNoLongerSettle() {
        fee.setCreatedAt(now.minusMinutes(40));
        VnpayTransaction attempt = attemptExpiringAt(now.minusMinutes(VnpayPaymentGuard.SETTLEMENT_GRACE.toMinutes() + 1));

        assertEquals(1, service.expireUnpaidCourseEnrollments());

        assertEquals("failed", attempt.getStatus());
        assertEquals("failed", fee.getStatus());
        assertEquals("cancelled", enrollment.getStatus());
    }

    @Test
    void aFeeWithoutAnyVnpayAttemptIsStillReleasedAfterTheHold() {
        when(transactions.findAllByPaymentId(anyLong())).thenReturn(List.of());

        assertEquals(1, service.expireUnpaidCourseEnrollments());

        assertEquals("failed", fee.getStatus());
        assertEquals("cancelled", enrollment.getStatus());
    }
}
