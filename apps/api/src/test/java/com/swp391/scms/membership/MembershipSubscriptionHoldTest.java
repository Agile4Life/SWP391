package com.swp391.scms.membership;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.swp391.scms.membership.entity.MembershipSubscription;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Bộ kiểm thử cho MembershipSubscriptionHold (membership subscription hold). */
class MembershipSubscriptionHoldTest {
    /** Hàm trợ giúp của test: tạo subscription đang tạm hoãn. */
    private static MembershipSubscription held(String status) {
        MembershipSubscription s = new MembershipSubscription();
        s.setHoldStatus(status);
        s.setHoldStartDate(LocalDate.of(2026, 12, 10));
        s.setHoldEndDate(LocalDate.of(2026, 12, 20));
        return s;
    }

    /** Kiểm thử: tạm hoãn đã duyệt chặn toàn bộ khoảng thời gian của nó (gồm cả hai đầu). */
    @Test
    void approvedHoldBlocksItsWholeWindowInclusive() {
        MembershipSubscription s = held("APPROVED");
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 10)));
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 15)));
        assertTrue(s.isHeldOn(LocalDate.of(2026, 12, 20)));
        assertFalse(s.isHeldOn(LocalDate.of(2026, 12, 9)));
        assertFalse(s.isHeldOn(LocalDate.of(2026, 12, 21)));
    }

    /** Kiểm thử: tạm hoãn đang chờ hoặc không có ngày thì không chặn gì. */
    @Test
    void pendingOrUndatedHoldBlocksNothing() {
        assertFalse(held("PENDING").isHeldOn(LocalDate.of(2026, 12, 15)));
        assertFalse(new MembershipSubscription().isHeldOn(LocalDate.of(2026, 12, 15)));
    }
}
