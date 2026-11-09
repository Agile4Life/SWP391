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
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Spec 2026-11-09 sections 1.3 and 1.5: a course must fit the membership; an upgrade keeps the credits already spent. */
class CourseMembershipRulesTest {
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");
    private EnrollmentService service;

    @BeforeEach
    void setUp() {
        service = new EnrollmentService(enrollments, null, gymClasses, subscriptions, members, null, null, clock);
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);
        when(members.findById(100L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(true);
    }

    private MembershipSubscription sub(long id, String tier, int credits, LocalDate start, LocalDate end) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setId(id);
        pkg.setName(tier);
        pkg.setTier(tier);
        pkg.setDurationDays(30);
        pkg.setClassCreditLimit(credits);
        MembershipSubscription s = new MembershipSubscription();
        s.setId(id);
        s.setMembershipPackage(pkg);
        s.setStatus("active");
        s.setStartDate(start);
        s.setEndDate(end);
        return s;
    }

    private GymClass course(LocalDate start, LocalDate end) {
        GymClass c = new GymClass();
        c.setId(50L);
        c.setName("Yoga");
        c.setStatus("active");
        c.setStartDate(start);
        c.setEndDate(end);
        c.setCapacity(20);
        c.setPrice(new BigDecimal("500000"));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void courseEndingAfterTheMembershipIsRejectedUntilTheMemberRenews() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L));
        assertEquals("SCHEDULING_COURSE_EXCEEDS_MEMBERSHIP", ex.getErrorCode());
    }

    @Test
    void aPaidRenewalThatFollowsWithoutAGapExtendsTheCoverage() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 30))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(0L);
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(eq(100L), eq("booked"), any(), any()))
                .thenReturn(0L);
        when(enrollments.save(any())).thenAnswer(i -> i.getArgument(0));

        assertDoesNotThrow(() -> service.enrollCourse(principal, 50L));
    }

    @Test
    void aGapBetweenPeriodsDoesNotExtendTheCoverage() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 10), LocalDate.of(2027, 1, 8))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));

        assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L));
    }

    @Test
    void upgradingKeepsTheCreditsAlreadySpentOnThePreviousPlan() {
        // Silver 1 credit, used 1 on Nov 2, upgraded to Gold (2 credits) on Nov 9: only one credit is left.
        MembershipSubscription silver = sub(1, "SILVER", 1, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 8));
        MembershipSubscription gold = sub(2, "GOLD", 2, LocalDate.of(2026, 11, 9), LocalDate.of(2026, 12, 8));
        gold.setPreviousSubscription(silver);
        gold.setUpgradeCharge(new BigDecimal("100000"));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(gold));
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(
                eq(100L), eq("booked"), eq(LocalDate.of(2026, 11, 1)), eq(LocalDate.of(2026, 12, 8)))).thenReturn(1L);

        QuotaDto quota = service.getMemberCourseQuota(principal);

        assertEquals(Integer.valueOf(2), quota.totalCredits());
        assertEquals(1, quota.usedCredits());
        assertEquals(1, quota.remainingCredits());
    }

    @Test
    void theMyCoursesListShowsHowManySessionsAreLeftAfterAttendedMissedAndExcusedOnes() {
        com.swp391.scms.scheduling.repository.ClassSessionRepository sessionRepo =
                mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        com.swp391.scms.attendance.repository.SessionAttendanceRepository attendanceRepo =
                mock(com.swp391.scms.attendance.repository.SessionAttendanceRepository.class);
        EnrollmentService withProgress = new EnrollmentService(enrollments, sessionRepo, gymClasses, subscriptions, members, null, null, clock);
        org.springframework.test.util.ReflectionTestUtils.setField(withProgress, "attendanceRepository", attendanceRepo);
        GymClass course = course(LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 22));
        Member owner = new Member();
        owner.setUserId(100L);
        com.swp391.scms.scheduling.entity.ClassEnrollment enrollment = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        enrollment.setGymClass(course);
        enrollment.setMember(owner);
        enrollment.setStatus("booked");
        when(enrollments.findByMemberUserId(100L)).thenReturn(List.of(enrollment));
        // 9 sessions; the member attended 3, missed 1 and 1 was excused: 5 are left.
        when(sessionRepo.countByGymClassIdAndStatusNot(50L, "cancelled")).thenReturn(9L);
        when(attendanceRepo.countAttended(100L, 50L)).thenReturn(3L);
        when(attendanceRepo.countRecorded(100L, 50L)).thenReturn(5L);

        var item = withProgress.myEnrollments(principal).get(0);

        assertEquals(Integer.valueOf(9), item.totalSessions());
        assertEquals(Integer.valueOf(3), item.attendedSessions());
        assertEquals(Integer.valueOf(4), item.remainingSessions());
    }

    @Test
    void aRenewalStartsAFreshAllowance() {
        MembershipSubscription first = sub(1, "GOLD", 2, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 30));
        MembershipSubscription renewal = sub(2, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30));
        renewal.setPreviousSubscription(first);
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(renewal));
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(
                eq(100L), eq("booked"), eq(LocalDate.of(2026, 11, 1)), eq(LocalDate.of(2026, 11, 30)))).thenReturn(0L);

        assertEquals(2, service.getMemberCourseQuota(principal).remainingCredits());
    }

    @Test
    void aMemberBlockedForMissingMostOfACourseCannotEnrollUntilTheBlockEnds() {
        Member blocked = new Member();
        blocked.setUserId(100L);
        blocked.setCourseEnrollBlockedUntil(java.time.LocalDateTime.of(2026, 12, 1, 8, 0));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(blocked));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L));
        assertEquals("SCHEDULING_COURSE_ENROLL_BLOCKED", ex.getErrorCode());
        assertThrows(ForbiddenException.class, () -> service.checkoutCourse(principal, 50L, "cash"));
    }

    @Test
    void theQuotaReportsTheBlockSoTheMemberSeesWhyEnrollingIsOff() {
        Member blocked = new Member();
        blocked.setUserId(100L);
        blocked.setCourseEnrollBlockedUntil(java.time.LocalDateTime.of(2026, 12, 1, 8, 0));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(blocked));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of());

        assertEquals(java.time.LocalDateTime.of(2026, 12, 1, 8, 0), service.getMemberCourseQuota(principal).enrollBlockedUntil());
    }
}
