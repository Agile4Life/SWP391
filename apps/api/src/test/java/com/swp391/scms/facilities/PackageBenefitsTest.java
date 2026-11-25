package com.swp391.scms.facilities;

import static org.junit.jupiter.api.Assertions.*;

import com.swp391.scms.facilities.entity.MembershipPackage;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Bộ kiểm thử cho PackageBenefits (package benefits). */
class PackageBenefitsTest {
    /** Hàm trợ giúp của test: tạo gói tập mẫu. */
    private static MembershipPackage pkg(String name, String tier, int days) {
        MembershipPackage p = new MembershipPackage();
        p.setName(name);
        p.setTier(tier);
        p.setDurationDays(days);
        return p;
    }

    /** Kiểm thử: lượt khóa học tăng theo số chu kỳ 30 ngày. */
    @Test
    void courseCreditsScaleWithTheNumberOfThirtyDayCycles() {
        assertEquals(1, PackageBenefits.courseCredits("SILVER", 30));
        assertEquals(2, PackageBenefits.courseCredits("GOLD", 30));
        assertEquals(4, PackageBenefits.courseCredits("PLATINUM", 30));
        assertEquals(3, PackageBenefits.courseCredits("SILVER", 90));
        assertEquals(6, PackageBenefits.courseCredits("GOLD", 90));
        assertEquals(12, PackageBenefits.courseCredits("PLATINUM", 90));
    }

    /** Kiểm thử: số buổi PT theo hạng và gói thử có một buổi. */
    @Test
    void ptSessionsFollowTheTierAndTheTrialGetsOne() {
        assertEquals(0, PackageBenefits.ptSessionsPerCycle(pkg("SILVER", null, 30)));
        assertEquals(3, PackageBenefits.ptSessionsPerCycle(pkg("GOLD 3 THÁNG", null, 90)));
        assertEquals(6, PackageBenefits.ptSessionsPerCycle(pkg("PLATINUM", "PLATINUM", 30)));
        assertEquals(1, PackageBenefits.ptSessionsPerCycle(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

    /** Kiểm thử: số ngày tạm hoãn khớp bảng chính sách. */
    @Test
    void holdAllowanceMatchesThePolicyTable() {
        assertEquals(7, PackageBenefits.holdMaxDays(pkg("SILVER 3 THÁNG", "SILVER", 90)));
        assertEquals(15, PackageBenefits.holdMaxDays(pkg("GOLD 3 THÁNG", "GOLD", 90)));
        assertEquals(30, PackageBenefits.holdMaxDays(pkg("PLATINUM 3 THÁNG", "PLATINUM", 90)));
        assertEquals(7, PackageBenefits.holdMaxDays(pkg("PLATINUM", "PLATINUM", 30)));
        assertEquals(0, PackageBenefits.holdMaxDays(pkg("SILVER", "SILVER", 30)));
        assertEquals(0, PackageBenefits.holdMaxDays(pkg("GOLD", "GOLD", 30)));
        assertEquals(0, PackageBenefits.holdMaxDays(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

    /** Kiểm thử: giảm giá và phòng VIP chỉ cho Gold và Platinum đã trả phí. */
    @Test
    void discountsAndVipRoomAreForPaidGoldAndPlatinumOnly() {
        assertEquals(0, PackageBenefits.discountPercent(pkg("SILVER", null, 30)));
        assertEquals(10, PackageBenefits.discountPercent(pkg("GOLD", "GOLD", 30)));
        assertEquals(20, PackageBenefits.discountPercent(pkg("PLATINUM", null, 90)));
        assertEquals(0, PackageBenefits.discountPercent(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
        assertTrue(PackageBenefits.hasVipRoomAccess(pkg("PLATINUM", null, 30)));
        assertFalse(PackageBenefits.hasVipRoomAccess(pkg("GOLD", "GOLD", 30)));
        assertFalse(PackageBenefits.hasVipRoomAccess(pkg("Gói Trải Nghiệm 3 Ngày", "PLATINUM", 3)));
    }

    /** Kiểm thử: Silver không xem được kế hoạch tập nhưng gói thử thì xem được. */
    @Test
    void silverCannotSeeWorkoutPlansButTheTrialCan() {
        assertFalse(PackageBenefits.canViewWorkoutPlan(pkg("SILVER", null, 30)));
        assertTrue(PackageBenefits.canViewWorkoutPlan(pkg("GOLD", null, 30)));
        assertTrue(PackageBenefits.canViewWorkoutPlan(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

    /** Kiểm thử: các chu kỳ khởi động lại mỗi 30 ngày từ ngày bắt đầu. */
    @Test
    void cyclesRestartEveryThirtyDaysFromTheStartDate() {
        LocalDate start = LocalDate.of(2026, 11, 1);
        assertEquals(start, PackageBenefits.cycleStart(start, LocalDate.of(2026, 11, 30)));
        assertEquals(LocalDate.of(2026, 12, 1), PackageBenefits.cycleStart(start, LocalDate.of(2026, 12, 1)));
        assertEquals(LocalDate.of(2026, 11, 30), PackageBenefits.cycleEnd(start, LocalDate.of(2027, 1, 29), LocalDate.of(2026, 11, 15)));
        assertEquals(LocalDate.of(2027, 1, 29), PackageBenefits.cycleEnd(start, LocalDate.of(2027, 1, 29), LocalDate.of(2027, 1, 20)));
    }

    /** Kiểm thử: nâng cấp tiếp tục đếm chu kỳ từ gói bị thay, còn gia hạn bắt đầu mới. */
    @Test
    void anUpgradeKeepsCountingCyclesFromThePlanItReplacedButARenewalStartsFresh() {
        var silver = new com.swp391.scms.membership.entity.MembershipSubscription();
        silver.setId(1L);
        silver.setStartDate(LocalDate.of(2026, 11, 1));
        var gold = new com.swp391.scms.membership.entity.MembershipSubscription();
        gold.setId(2L);
        gold.setStartDate(LocalDate.of(2026, 11, 20));
        gold.setPreviousSubscription(silver);
        gold.setUpgradeCharge(new java.math.BigDecimal("100000"));
        var renewal = new com.swp391.scms.membership.entity.MembershipSubscription();
        renewal.setId(3L);
        renewal.setStartDate(LocalDate.of(2026, 12, 1));
        renewal.setPreviousSubscription(gold);

        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleAnchor(gold));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleAnchor(silver));
        assertEquals(LocalDate.of(2026, 12, 1), PackageBenefits.cycleAnchor(renewal));
        // Vào ngày 25/11, hội viên sau khi nâng cấp vẫn ở chu kỳ đầu tiên (1/11–30/11), không phải chu kỳ mới tính từ 20/11.
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(PackageBenefits.cycleAnchor(gold), LocalDate.of(2026, 11, 25)));
    }

    /** Kiểm thử: những ngày tạm hoãn không làm hao chu kỳ quyền lợi. */
    @Test
    void heldDaysDoNotEatTheBenefitCycle() {
        var sub = new com.swp391.scms.membership.entity.MembershipSubscription();
        sub.setId(1L);
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2027, 2, 5));
        // Chưa tạm hoãn lần nào: các chu kỳ 30 ngày thông thường (1/11–30/11, 1/12–30/12, ...).
        assertEquals(LocalDate.of(2026, 12, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 5)));

        // Tạm hoãn từ 11/11–17/11 (7 ngày): chu kỳ đầu được kéo dài thêm đúng số ngày hoãn và kết thúc vào 7/12, chu kỳ thứ hai bắt đầu từ 8/12.
        sub.setHoldUsed(true);
        sub.setHoldStartDate(LocalDate.of(2026, 11, 11));
        sub.setHoldEndDate(LocalDate.of(2026, 11, 17));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 11, 5)));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 11, 14)));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 7)));
        assertEquals(LocalDate.of(2026, 12, 7), PackageBenefits.cycleEnd(sub, LocalDate.of(2026, 11, 20)));
        assertEquals(LocalDate.of(2026, 12, 8), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 8)));
        assertEquals(LocalDate.of(2027, 1, 6), PackageBenefits.cycleEnd(sub, LocalDate.of(2026, 12, 20)));
        // Chu kỳ cuối cùng không bao giờ vượt quá ngày hết hạn của gói đăng ký.
        assertEquals(LocalDate.of(2027, 2, 5), PackageBenefits.cycleEnd(sub, LocalDate.of(2027, 2, 1)));
    }

    /** Kiểm thử P1-BE-22: cycleAnchor dừng trước gói Trial để gói trả phí bắt đầu chu kỳ từ ngày kích hoạt. */
    @Test
    void cycleAnchorStopsBeforeTrialSubscription() {
        var trial = new com.swp391.scms.membership.entity.MembershipSubscription();
        trial.setId(1L);
        trial.setMembershipPackage(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3));
        trial.setStatus("expired");
        trial.setStartDate(LocalDate.of(2026, 11, 1));
        trial.setEndDate(LocalDate.of(2026, 11, 3));

        var plat = new com.swp391.scms.membership.entity.MembershipSubscription();
        plat.setId(2L);
        plat.setMembershipPackage(pkg("PLATINUM 1 THÁNG", "PLATINUM", 30));
        plat.setStatus("active");
        plat.setStartDate(LocalDate.of(2026, 11, 3));
        plat.setEndDate(LocalDate.of(2026, 12, 2));
        plat.setPreviousSubscription(trial);
        plat.setUpgradeCharge(new java.math.BigDecimal("1500000"));

        assertEquals(LocalDate.of(2026, 11, 3), PackageBenefits.cycleAnchor(plat));
        // Ngày 1/12 và 2/12 vẫn thuộc chu kỳ duy nhất (3/11–2/12), không reset sang chu kỳ 2.
        assertEquals(LocalDate.of(2026, 11, 3), PackageBenefits.cycleStart(plat, LocalDate.of(2026, 12, 1)));
        assertEquals(LocalDate.of(2026, 12, 2), PackageBenefits.cycleEnd(plat, LocalDate.of(2026, 12, 1)));
    }

    /** Kiểm thử P1-BE-22: totalPtSessions giới hạn tổng số lượt PT theo thời hạn đã mua của gói. */
    @Test
    void totalPtSessionsCapsLifetimeQuotaByPurchasedDuration() {
        var plat30 = new com.swp391.scms.membership.entity.MembershipSubscription();
        plat30.setMembershipPackage(pkg("PLATINUM", "PLATINUM", 30));
        assertEquals(6, PackageBenefits.totalPtSessions(plat30));

        var plat90 = new com.swp391.scms.membership.entity.MembershipSubscription();
        plat90.setMembershipPackage(pkg("PLATINUM 3 THÁNG", "PLATINUM", 90));
        assertEquals(18, PackageBenefits.totalPtSessions(plat90));

        var gold30 = new com.swp391.scms.membership.entity.MembershipSubscription();
        gold30.setMembershipPackage(pkg("GOLD", "GOLD", 30));
        assertEquals(3, PackageBenefits.totalPtSessions(gold30));

        var trial = new com.swp391.scms.membership.entity.MembershipSubscription();
        trial.setMembershipPackage(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3));
        assertEquals(1, PackageBenefits.totalPtSessions(trial));

        var silver = new com.swp391.scms.membership.entity.MembershipSubscription();
        silver.setMembershipPackage(pkg("SILVER", "SILVER", 30));
        assertEquals(0, PackageBenefits.totalPtSessions(silver));
    }
}
