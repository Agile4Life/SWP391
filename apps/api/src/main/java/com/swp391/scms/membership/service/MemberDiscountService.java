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
 * Giảm giá theo hạng gói (Gold 10%, Platinum 20%) cho buổi PT lẻ, học phí khóa học và sản phẩm cửa hàng
 * (đặc tả 2026-11-09, mục 3.3). Phần trăm giảm giá lấy từ gói hội viên đang hiệu lực vào ngày tạo khoản thu.
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
     * Phần trăm giảm giá cao nhất trong các kỳ gói active đang hiệu lực của hội viên; trả về 0 khi không áp dụng.
     * Đánh dấu Transactional vì gói hội viên là quan hệ tải lười (lazy) và các bên gọi như endpoint báo giá công khai
     * chạy ngoài transaction (open-in-view đã tắt), nếu không sẽ ném LazyInitializationException.
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
     */
    public static BigDecimal discountOf(BigDecimal amount, int percent) {
        if (amount == null || percent <= 0) return BigDecimal.ZERO;
        return amount.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    /**
     * Số tiền sau khi giảm giá, không bao giờ nhỏ hơn 0.
     */
    public static BigDecimal apply(BigDecimal amount, int percent) {
        if (amount == null) return null;
        return amount.subtract(discountOf(amount, percent)).max(BigDecimal.ZERO);
    }
}
