package com.swp391.scms.membership.service;

import com.swp391.scms.common.CenterTime;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Giảm giá theo hạng gói (Gold 10%, Platinum 20%) cho buổi PT lẻ, học phí khóa học và sản phẩm; phần trăm lấy
 * từ gói đang hiệu lực vào ngày tạo khoản thu.
 *
 * Tier discount (Gold 10%, Platinum 20%) on extra PT sessions, course fees and shop products
 * (spec 2026-11-09, section 3.3). The percentage comes from the active membership on the day the charge is created.
 */
@Service
public class MemberDiscountService {
    private final MembershipSubscriptionRepository subscriptions;
    private final Clock clock;

    /** Nhận repository gói và Clock. */
    public MemberDiscountService(MembershipSubscriptionRepository subscriptions, Clock clock) {
        this.subscriptions = subscriptions;
        this.clock = clock;
    }

    /**
     * Phần trăm giảm cao nhất trong các kỳ gói active đang hiệu lực của hội viên; không có thì 0. Chạy trong
     * transaction vì gói là quan hệ lazy.
     *
     * Best discount among the member's active, currently valid periods; 0 when none applies.
     * Transactional because the package is a lazy association and callers such as the public quote
     * endpoint run outside a transaction (open-in-view is off), which otherwise throws LazyInitializationException.
     */
    @Transactional(readOnly = true)
    public int percentFor(Long memberId) {
        if (memberId == null) return 0;
        LocalDate today = LocalDate.now(clock.withZone(CenterTime.ZONE));
        return subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null
                        && !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                .mapToInt(s -> PackageBenefits.discountPercent(s.getMembershipPackage()))
                .max().orElse(0);
    }

    /**
     * Số tiền được giảm (làm tròn tới đồng).
     *
     * Amount of the discount in whole dong.
     */
    public static BigDecimal discountOf(BigDecimal amount, int percent) {
        if (amount == null || percent <= 0) return BigDecimal.ZERO;
        return amount.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    /**
     * Số tiền sau giảm, không bao giờ âm.
     *
     * The amount after the discount, never below zero.
     */
    public static BigDecimal apply(BigDecimal amount, int percent) {
        if (amount == null) return null;
        return amount.subtract(discountOf(amount, percent)).max(BigDecimal.ZERO);
    }
}
