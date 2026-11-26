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

/**
 * Bộ kiểm thử cho CourseMembershipRules (quy tắc khóa học theo gói hội viên).
 *
 * Đặc tả 2026-11-09 mục 1.3 và 1.5: khóa học phải nằm trong thời hạn gói hội viên; khi nâng cấp gói vẫn giữ nguyên số lượt đã sử dụng.
 */
class CourseMembershipRulesTest {
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");
    private EnrollmentService service;

    /** Chuẩn bị trước mỗi test: tạo dịch vụ khóa học với dữ liệu membership giả lập. */
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

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (sub). */
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

    /** Hàm trợ giúp của test: tạo khóa học theo ngày bắt đầu/kết thúc. */
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

    /** Kiểm thử: khóa kết thúc sau khi membership hết hạn bị từ chối cho đến khi hội viên gia hạn. */
    @Test
    void courseEndingAfterTheMembershipIsRejectedUntilTheMemberRenews() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L));
        assertEquals("SCHEDULING_COURSE_EXCEEDS_MEMBERSHIP", ex.getErrorCode());
    }

    /** Kiểm thử: gia hạn có trả phí nối tiếp không gián đoạn thì kéo dài thời gian được bao phủ. */
    @Test
    void aPaidRenewalThatFollowsWithoutAGapExtendsTheCoverage() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 30))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(0L);
        when(enrollments.countUsedFreeCreditsBetween(eq(100L), any(), any())).thenReturn(0L);
        when(enrollments.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        assertDoesNotThrow(() -> service.enrollCourse(principal, 50L));
    }

    /** Kiểm thử: khoảng trống giữa các kỳ không làm kéo dài thời gian được bao phủ. */
    @Test
    void aGapBetweenPeriodsDoesNotExtendTheCoverage() {
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 10), LocalDate.of(2027, 1, 8))));
        course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 20));

        assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L));
    }

    /** Kiểm thử: nâng cấp gói vẫn giữ các lượt đã dùng ở gói trước. */
    @Test
    void upgradingKeepsTheCreditsAlreadySpentOnThePreviousPlan() {
        // Gói Silver có 1 lượt, đã dùng 1 vào ngày 02/11, nâng cấp lên Gold (2 lượt) vào ngày 09/11: chỉ còn 1 lượt.
        MembershipSubscription silver = sub(1, "SILVER", 1, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 8));
        MembershipSubscription gold = sub(2, "GOLD", 2, LocalDate.of(2026, 11, 9), LocalDate.of(2026, 12, 8));
        gold.setPreviousSubscription(silver);
        gold.setUpgradeCharge(new BigDecimal("100000"));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(gold));
        when(enrollments.countUsedFreeCreditsBetween(
                eq(100L), eq(LocalDate.of(2026, 11, 1)), eq(LocalDate.of(2026, 12, 8)))).thenReturn(1L);

        QuotaDto quota = service.getMemberCourseQuota(principal);

        assertEquals(Integer.valueOf(2), quota.totalCredits());
        assertEquals(1, quota.usedCredits());
        assertEquals(1, quota.remainingCredits());
    }

    /** Kiểm thử: danh sách khóa của tôi hiển thị số buổi còn lại sau khi trừ buổi đã dự, vắng và được miễn. */
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
        // 9 buổi học; hội viên đã dự 3, vắng 1 và được miễn 1: đã ghi nhận 5 buổi (còn lại 4 buổi).
        when(sessionRepo.countByGymClassIdAndStatusNot(50L, "cancelled")).thenReturn(9L);
        when(attendanceRepo.countAttended(100L, 50L)).thenReturn(3L);
        when(attendanceRepo.countRecorded(100L, 50L)).thenReturn(5L);

        var item = withProgress.myEnrollments(principal).get(0);

        assertEquals(Integer.valueOf(9), item.totalSessions());
        assertEquals(Integer.valueOf(3), item.attendedSessions());
        assertEquals(Integer.valueOf(4), item.remainingSessions());
    }

    /** Kiểm thử: gia hạn bắt đầu hạn mức mới. */
    @Test
    void aRenewalStartsAFreshAllowance() {
        MembershipSubscription first = sub(1, "GOLD", 2, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 30));
        MembershipSubscription renewal = sub(2, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30));
        renewal.setPreviousSubscription(first);
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(renewal));
        when(enrollments.countUsedFreeCreditsBetween(
                eq(100L), eq(LocalDate.of(2026, 11, 1)), eq(LocalDate.of(2026, 11, 30)))).thenReturn(0L);

        assertEquals(2, service.getMemberCourseQuota(principal).remainingCredits());
    }

    /** Kiểm thử: hội viên bị chặn vì vắng gần hết khóa không đăng ký được đến khi hết lệnh chặn. */
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

    /** Kiểm thử P2-BE-19: hạn mức đọc không lấy khóa ghi và báo đúng lệnh chặn mà không fallback sang gói ngoài hạn. */
    @Test
    void theQuotaReportsTheBlockSoTheMemberSeesWhyEnrollingIsOff() {
        Member blocked = new Member();
        blocked.setUserId(100L);
        blocked.setCourseEnrollBlockedUntil(java.time.LocalDateTime.of(2026, 12, 1, 8, 0));
        when(members.findById(100L)).thenReturn(Optional.of(blocked));
        MembershipSubscription futureSub = sub(3, "GOLD", 2, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(futureSub));

        QuotaDto quota = service.getMemberCourseQuota(principal);

        assertEquals(java.time.LocalDateTime.of(2026, 12, 1, 8, 0), quota.enrollBlockedUntil());
        assertNull(quota.tier());
        assertEquals(0, quota.remainingCredits());
        org.mockito.Mockito.verify(members, org.mockito.Mockito.never()).findByUserIdForUpdate(100L);
    }

    /** Kiểm thử P1-BE-17: gia hạn nối tiếp cho phép đăng ký khóa bắt đầu sau kỳ hiện tại (dù 1 dòng gói không phủ cả 2 ngày). */
    @Test
    void contiguousRenewalAllowsEnrollingInCourseStartingInNextPeriod() {
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(), any())).thenReturn(false);
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31))));
        course(LocalDate.of(2026, 12, 5), LocalDate.of(2026, 12, 20));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(0L);
        when(enrollments.countUsedFreeCreditsBetween(eq(100L), any(), any())).thenReturn(0L);
        when(enrollments.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        assertDoesNotThrow(() -> service.enrollCourse(principal, 50L));
    }

    /** Kiểm thử P1-BE-17: bảo lưu đã duyệt chồng lên buổi giữa khóa sẽ chặn đăng ký khóa học. */
    @Test
    void approvedHoldOverlappingMidCourseSessionIsRejected() {
        var sessionRepo = mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        EnrollmentService withSessions = new EnrollmentService(
                enrollments, sessionRepo, gymClasses, subscriptions, members, null, null, clock);

        MembershipSubscription active = sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 31));
        active.setHoldStatus("APPROVED");
        active.setHoldStartDate(LocalDate.of(2026, 11, 25));
        active.setHoldEndDate(LocalDate.of(2026, 11, 30));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(active));

        GymClass c = course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 10));
        var s1 = new com.swp391.scms.scheduling.entity.ClassSession();
        s1.setGymClass(c);
        s1.setSessionDate(LocalDate.of(2026, 11, 20));
        s1.setStatus("scheduled");
        var s2 = new com.swp391.scms.scheduling.entity.ClassSession();
        s2.setGymClass(c);
        s2.setSessionDate(LocalDate.of(2026, 11, 27));
        s2.setStatus("scheduled");
        when(sessionRepo.findByGymClassIdOrderBySessionDateAscStartTimeAsc(50L)).thenReturn(List.of(s1, s2));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () -> withSessions.enrollCourse(principal, 50L));
        assertEquals("SCHEDULING_MEMBERSHIP_ON_HOLD", ex.getErrorCode());

        ForbiddenException checkoutEx = assertThrows(ForbiddenException.class,
                () -> withSessions.checkoutCourse(principal, 50L, "cash"));
        assertEquals("SCHEDULING_MEMBERSHIP_ON_HOLD", checkoutEx.getErrorCode());
    }

    /** Kiểm thử P1-BE-13 & P1-BE-17: phòng VIP Platinum chặn non-Platinum trong checkoutCourse và chặn gói Platinum hết hạn giữa khóa. */
    @Test
    void platinumVipRoomRequiresPlatinumAcrossEntireCourseInEnrollAndCheckout() {
        com.swp391.scms.facilities.entity.Room vipRoom = new com.swp391.scms.facilities.entity.Room();
        vipRoom.setId(9L);
        vipRoom.setName("Phòng Gym VIP");
        vipRoom.setTier("PLATINUM");
        GymClass c = course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 15));
        c.setRoom(vipRoom);

        // 1. Hội viên Gold (không phải Platinum) bị chặn ở checkoutCourse
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 31))));
        ForbiddenException goldCheckout = assertThrows(ForbiddenException.class,
                () -> service.checkoutCourse(principal, 50L, "cash"));
        assertEquals("SCHEDULING_ROOM_PLATINUM_REQUIRED", goldCheckout.getErrorCode());

        // 2. Platinum hết hạn 30/11 rồi gia hạn bằng Gold 01/12..31/12 -> không đủ Platinum suốt khóa -> chặn cả enroll lẫn checkout
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "PLATINUM", 4, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "GOLD", 2, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31))));
        assertEquals("SCHEDULING_ROOM_PLATINUM_REQUIRED",
                assertThrows(ForbiddenException.class, () -> service.enrollCourse(principal, 50L)).getErrorCode());
        assertEquals("SCHEDULING_ROOM_PLATINUM_REQUIRED",
                assertThrows(ForbiddenException.class, () -> service.checkoutCourse(principal, 50L, "cash")).getErrorCode());

        // 3. Platinum nối tiếp Platinum phủ trọn khóa -> cho phép
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "PLATINUM", 4, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30)),
                sub(2, "PLATINUM", 4, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31))));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(0L);
        when(enrollments.countUsedFreeCreditsBetween(eq(100L), any(), any())).thenReturn(0L);
        when(enrollments.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        assertDoesNotThrow(() -> service.enrollCourse(principal, 50L));
    }

    /** Kiểm thử P1-BE-20: enrollCourse và checkoutCourse tính thêm busiestSession và chặn trùng SessionBooking. */
    @Test
    void courseEnrollmentChecksBusiestSessionCapacityAndDuplicateSessionBooking() {
        var sbRepo = mock(com.swp391.scms.scheduling.repository.SessionBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "sessionBookings", sbRepo);
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(
                sub(1, "GOLD", 2, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 31))));
        GymClass c = course(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 12, 10));
        c.setCapacity(5);
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());

        // 1. Đã có SessionBooking lẻ trong lớp -> 409 SCHEDULING_ALREADY_ENROLLED
        when(sbRepo.existsBySessionGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(true);
        assertEquals("SCHEDULING_ALREADY_ENROLLED",
                assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                        () -> service.enrollCourse(principal, 50L)).getErrorCode());
        assertEquals("SCHEDULING_ALREADY_ENROLLED",
                assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                        () -> service.checkoutCourse(principal, 50L, "cash")).getErrorCode());

        // 2. 3 ghi danh toàn lớp + 2 đặt lẻ ở buổi đông nhất = 5 == capacity -> 409 SCHEDULING_CLASS_FULL
        when(sbRepo.existsBySessionGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(false);
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(3L);
        when(sbRepo.countBookedGroupedBySession(50L))
                .thenReturn(List.of(new com.swp391.scms.scheduling.dto.SessionBookingCount(101L, 2L)));
        when(enrollments.countUsedFreeCreditsBetween(eq(100L), any(), any())).thenReturn(0L);
        assertEquals("SCHEDULING_CLASS_FULL",
                assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                        () -> service.enrollCourse(principal, 50L)).getErrorCode());
        assertEquals("SCHEDULING_CLASS_FULL",
                assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                        () -> service.checkoutCourse(principal, 50L, "cash")).getErrorCode());
    }
}
