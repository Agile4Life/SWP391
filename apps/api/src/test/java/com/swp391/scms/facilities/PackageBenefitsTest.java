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
}
