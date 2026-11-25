package com.swp391.scms.membership;
import com.swp391.scms.membership.service.MembershipKycEligibility;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class MembershipKycEligibilityTest {
    @Test void rejectsUnverifiedAndPendingOrRejectedEvenWithStaleBoolean() {
        for (String status : new String[]{null, "PENDING", "REJECTED"}) {
            Member member = new Member(); member.setKycStatus(status);
            assertThrows(BadRequestException.class, () -> MembershipKycEligibility.requireVerified(member, false));
            if (status != null) { member.setIdentityVerified(true);
                assertThrows(BadRequestException.class, () -> MembershipKycEligibility.requireVerified(member, false)); }
        }
    }
    @Test void acceptsApprovedIdentityAndApprovedTrial() {
        Member member = new Member(); member.setIdentityVerified(true); member.setKycStatus("APPROVED");
        assertDoesNotThrow(() -> MembershipKycEligibility.requireVerified(member, false));
        member.setIdentityVerified(false); member.setKycStatus("PENDING");
        assertDoesNotThrow(() -> MembershipKycEligibility.requireVerified(member, true));
    }
}
