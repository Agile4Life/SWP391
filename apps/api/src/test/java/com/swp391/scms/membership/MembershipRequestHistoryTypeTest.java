package com.swp391.scms.membership;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Bộ kiểm thử cho MembershipRequestHistoryType (membership request history type).
 *
 * The desk's request history labels each processed request as a registration, renewal or upgrade.
 */
class MembershipRequestHistoryTypeTest {

    /** Hàm trợ giúp của test: xác định loại của một kỳ trong lịch sử yêu cầu. */
    private static String typeOf(MembershipSubscription sub) throws Exception {
        Method method = com.swp391.scms.membership.service.MembershipRequestHistoryService.class
                .getDeclaredMethod("typeOf", MembershipSubscription.class);
        method.setAccessible(true);
        return (String) method.invoke(null, sub);
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (sub). */
    private static MembershipSubscription sub(long packageId) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setId(packageId);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        return sub;
    }

    /** Kiểm thử: kỳ đầu tiên là đăng ký mới. */
    @Test
    void firstPeriodIsARegistration() throws Exception {
        assertThat(typeOf(sub(1))).isEqualTo("REGISTER");
    }

    /** Kiểm thử: cùng gói sau một kỳ trước là gia hạn. */
    @Test
    void samePackageAfterAPreviousPeriodIsARenewal() throws Exception {
        MembershipSubscription renewal = sub(1);
        renewal.setPreviousSubscription(sub(1));
        assertThat(typeOf(renewal)).isEqualTo("RENEW");
    }

    /** Kiểm thử: gói khác hoặc khoản phí nâng cấp là nâng cấp. */
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
