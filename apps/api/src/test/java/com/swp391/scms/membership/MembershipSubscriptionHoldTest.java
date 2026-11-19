package com.swp391.scms.membership;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.swp391.scms.membership.entity.MembershipSubscription;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class MembershipSubscriptionHoldTest {
    private static MembershipSubscription held(String status) {
        MembershipSubscription s = new MembershipSubscription();
        s.setHoldStatus(status);
        s.setHoldStartDate(LocalDate.of(2026, 12, 10));
        s.setHoldEndDate(LocalDate.of(2026, 12, 20));
        return s;
    }

    @Test
    void approvedHoldBlocksItsWholeWindowInclusive() {
        MembershipSubscription s = held("APPROVED");
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 10)));
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 15)));
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 20)));
        assertFalse(s.isHeldOn(LocalDate.of(2026, 12, 9)));
        assertFalse(s.isHeldOn(LocalDate.of(2026, 12, 21)));
    }

    @Test
    void pendingOrUndatedHoldBlocksNothing() {
        assertFalse(held("PENDING").isHeldOn(LocalDate.of(2026, 12, 15)));
        assertFalse(new MembershipSubscription().isHeldOn(LocalDate.of(2026, 12, 15)));
    }
}
