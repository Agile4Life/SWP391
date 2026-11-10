package com.swp391.scms.scheduling;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A member cannot cancel a course that has started; before the start the unpaid fee is voided. */
class CourseCancellationRulesTest {
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final AuthenticatedPrincipal member = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");
    private EnrollmentService service;
    private ClassEnrollment enrollment;

    @BeforeEach
    void setUp() {
        service = new EnrollmentService(enrollments, null, gymClasses, null, members, notifications, null, clock);
        service.setPaymentRepository(payments);
        Member owner = new Member();
        owner.setUserId(100L);
        enrollment = new ClassEnrollment();
        enrollment.setId(9L);
        enrollment.setMember(owner);
        enrollment.setStatus("booked");
        when(enrollments.findClassIdById(9L)).thenReturn(Optional.of(50L));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(new GymClass()));
        when(enrollments.findByIdForUpdate(9L)).thenReturn(Optional.of(enrollment));
        when(enrollments.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private void courseStarting(LocalDate start) {
        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStartDate(start);
        enrollment.setGymClass(gymClass);
    }

    @Test
    void aMemberCannotCancelACourseThatHasStartedSoTheCreditIsNotGivenBack() {
        courseStarting(LocalDate.of(2026, 11, 2));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.cancel(member, 9L));

        assertEquals("SCHEDULING_CANNOT_CANCEL_STARTED_COURSE", ex.getErrorCode());
        assertEquals("booked", enrollment.getStatus());
        // The course starting today is also started.
        courseStarting(LocalDate.of(2026, 11, 9));
        assertThrows(BadRequestException.class, () -> service.cancel(member, 9L));
    }

    @Test
    void theDeskMayStillCancelOnBehalfOfAMemberAfterTheStart() {
        courseStarting(LocalDate.of(2026, 11, 2));

        service.cancel(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 9L);

        assertEquals("cancelled", enrollment.getStatus());
    }

    @Test
    void cancellingBeforeTheStartReleasesTheSeatAndVoidsTheUnpaidFee() {
        courseStarting(LocalDate.of(2026, 11, 20));
        Payment pending = new Payment();
        pending.setStatus("pending");
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(pending));

        service.cancel(member, 9L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("failed", pending.getStatus());
        verify(payments).save(pending);
    }
}
