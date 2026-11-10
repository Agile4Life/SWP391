package com.swp391.scms.facilities;

import static org.junit.jupiter.api.Assertions.*;

import com.swp391.scms.facilities.entity.MembershipPackage;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PackageBenefitsTest {
    private static MembershipPackage pkg(String name, String tier, int days) {
        MembershipPackage p = new MembershipPackage();
        p.setName(name);
        p.setTier(tier);
        p.setDurationDays(days);
        return p;
    }

    @Test
    void courseCreditsScaleWithTheNumberOfThirtyDayCycles() {
        assertEquals(1, PackageBenefits.courseCredits("SILVER", 30));
        assertEquals(2, PackageBenefits.courseCredits("GOLD", 30));
        assertEquals(4, PackageBenefits.courseCredits("PLATINUM", 30));
        assertEquals(3, PackageBenefits.courseCredits("SILVER", 90));
        assertEquals(6, PackageBenefits.courseCredits("GOLD", 90));
        assertEquals(12, PackageBenefits.courseCredits("PLATINUM", 90));
    }

    @Test
    void ptSessionsFollowTheTierAndTheTrialGetsOne() {
        assertEquals(0, PackageBenefits.ptSessionsPerCycle(pkg("SILVER", null, 30)));
        assertEquals(3, PackageBenefits.ptSessionsPerCycle(pkg("GOLD 3 THÁNG", null, 90)));
        assertEquals(6, PackageBenefits.ptSessionsPerCycle(pkg("PLATINUM", "PLATINUM", 30)));
        assertEquals(1, PackageBenefits.ptSessionsPerCycle(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

    @Test
    void courtBookingsFollowTheTierAndTheTrialGetsNone() {
        assertEquals(1, PackageBenefits.courtBookingsPerCycle(pkg("SILVER", null, 30)));
        assertEquals(2, PackageBenefits.courtBookingsPerCycle(pkg("GOLD", "GOLD", 30)));
        assertEquals(3, PackageBenefits.courtBookingsPerCycle(pkg("PLATINUM", null, 30)));
        assertEquals(0, PackageBenefits.courtBookingsPerCycle(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

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

    @Test
    void silverCannotSeeWorkoutPlansButTheTrialCan() {
        assertFalse(PackageBenefits.canViewWorkoutPlan(pkg("SILVER", null, 30)));
        assertTrue(PackageBenefits.canViewWorkoutPlan(pkg("GOLD", null, 30)));
        assertTrue(PackageBenefits.canViewWorkoutPlan(pkg("Gói Trải Nghiệm 3 Ngày", "GOLD", 3)));
    }

    @Test
    void cyclesRestartEveryThirtyDaysFromTheStartDate() {
        LocalDate start = LocalDate.of(2026, 11, 1);
        assertEquals(start, PackageBenefits.cycleStart(start, LocalDate.of(2026, 11, 30)));
        assertEquals(LocalDate.of(2026, 12, 1), PackageBenefits.cycleStart(start, LocalDate.of(2026, 12, 1)));
        assertEquals(LocalDate.of(2026, 11, 30), PackageBenefits.cycleEnd(start, LocalDate.of(2027, 1, 29), LocalDate.of(2026, 11, 15)));
        assertEquals(LocalDate.of(2027, 1, 29), PackageBenefits.cycleEnd(start, LocalDate.of(2027, 1, 29), LocalDate.of(2027, 1, 20)));
    }

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
        // On Nov 25 the upgraded member is still in the first cycle (Nov 1-30), not a new one from Nov 20.
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(PackageBenefits.cycleAnchor(gold), LocalDate.of(2026, 11, 25)));
    }

    @Test
    void heldDaysDoNotEatTheBenefitCycle() {
        var sub = new com.swp391.scms.membership.entity.MembershipSubscription();
        sub.setId(1L);
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2027, 2, 5));
        // Nothing held yet: plain 30-day cycles (Nov 1-30, Dec 1-30, ...).
        assertEquals(LocalDate.of(2026, 12, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 5)));

        // Held Nov 11-17 (7 days): the first cycle is stretched by the hold and ends Dec 7, the second starts Dec 8.
        sub.setHoldUsed(true);
        sub.setHoldStartDate(LocalDate.of(2026, 11, 11));
        sub.setHoldEndDate(LocalDate.of(2026, 11, 17));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 11, 5)));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 11, 14)));
        assertEquals(LocalDate.of(2026, 11, 1), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 7)));
        assertEquals(LocalDate.of(2026, 12, 7), PackageBenefits.cycleEnd(sub, LocalDate.of(2026, 11, 20)));
        assertEquals(LocalDate.of(2026, 12, 8), PackageBenefits.cycleStart(sub, LocalDate.of(2026, 12, 8)));
        assertEquals(LocalDate.of(2027, 1, 6), PackageBenefits.cycleEnd(sub, LocalDate.of(2026, 12, 20)));
        // The last cycle never runs past the end of the subscription.
        assertEquals(LocalDate.of(2027, 2, 5), PackageBenefits.cycleEnd(sub, LocalDate.of(2027, 2, 1)));
    }
}
