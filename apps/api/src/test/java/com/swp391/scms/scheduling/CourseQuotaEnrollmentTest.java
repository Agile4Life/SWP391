package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.QuotaDto;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseQuotaEnrollmentTest {

    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private MemberRepository members = mock(MemberRepository.class);
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private EnrollmentService enrollmentService;

    @BeforeEach
    void setUp() {
        enrollmentService = new EnrollmentService(enrollments, null, gymClasses, subscriptions, members, null, null, clock);
    }

    @Test
    void testSilverQuotaCalculation() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        when(members.findById(100L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setName("SILVER");
        silver.setTier("SILVER");
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class))).thenReturn(true);
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(100L, "booked", sub.getStartDate(), sub.getEndDate())).thenReturn(1L);

        QuotaDto quota = enrollmentService.getMemberCourseQuota(principal);
        assertEquals("SILVER", quota.tier());
        assertEquals(2, quota.totalCredits());
        assertEquals(1, quota.usedCredits());
        assertEquals(1, quota.remainingCredits());
        assertFalse(quota.unlimited());
    }

    @Test
    void testEnrollFailsWhenQuotaExceeded() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
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
        // Already used 2 credits
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(100L, "booked", sub.getStartDate(), sub.getEndDate())).thenReturn(2L);

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 11, 30));
        gymClass.setCapacity(20);
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));

        assertThrows(ForbiddenException.class, () -> enrollmentService.enrollCourse(principal, 50L));
    }
}
