package com.swp391.scms.membership;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** The desk's request history labels each processed request as a registration, renewal or upgrade. */
class MembershipRequestHistoryTypeTest {

    private static String typeOf(MembershipSubscription sub) throws Exception {
        Method method = com.swp391.scms.membership.service.MembershipRequestHistoryService.class
                .getDeclaredMethod("typeOf", MembershipSubscription.class);
        method.setAccessible(true);
        return (String) method.invoke(null, sub);
    }

    private static MembershipSubscription sub(long packageId) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setId(packageId);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        return sub;
    }

    @Test
    void firstPeriodIsARegistration() throws Exception {
        assertThat(typeOf(sub(1))).isEqualTo("REGISTER");
    }

    @Test
    void samePackageAfterAPreviousPeriodIsARenewal() throws Exception {
        MembershipSubscription renewal = sub(1);
        renewal.setPreviousSubscription(sub(1));
        assertThat(typeOf(renewal)).isEqualTo("RENEW");
    }

    @Test
    void otherPackageOrUpgradeChargeIsAnUpgrade() throws Exception {
        MembershipSubscription upgrade = sub(3);
        upgrade.setPreviousSubscription(sub(10));
        assertThat(typeOf(upgrade)).isEqualTo("UPGRADE");

        MembershipSubscription samePackageUpgrade = sub(1);
        samePackageUpgrade.setPreviousSubscription(sub(1));
        samePackageUpgrade.setUpgradeCharge(new BigDecimal("50000"));
        assertThat(typeOf(samePackageUpgrade)).isEqualTo("UPGRADE");
    }
}
