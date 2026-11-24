package com.swp391.scms.courts.service;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * Bảng giá sân và số lượt đặt sân miễn phí mỗi gói có trong một chu kỳ 30 ngày.
 *
 * Phí sân và số lượt đặt sân mà mỗi gói membership bao gồm trong một chu kỳ 30 ngày.
 */
public final class CourtPricing {
    public static final String PACKAGE_QUOTA = "package_quota";
    /** Khung một giờ, cho bất kỳ loại sân nào trong ba loại. */
    public static final BigDecimal STANDARD_PRICE = new BigDecimal("100000");
    /** Khung bắt đầu từ 18:00 trở đi; giá đã gồm đèn chiếu sáng sân. */
    public static final BigDecimal EVENING_PRICE = new BigDecimal("125000");
    public static final LocalTime EVENING_FROM = LocalTime.of(18, 0);

    /** Constructor private: lớp tiện ích chỉ có hàm static. */
    private CourtPricing() {}

    /** Giá một khung 1 giờ: giá thường trước 18:00, giá buổi tối (đã gồm đèn) từ 18:00. */
    public static BigDecimal priceFor(LocalTime start) {
        return start.isBefore(EVENING_FROM) ? STANDARD_PRICE : EVENING_PRICE;
    }

    /**
     * Số lượt đặt sân miễn phí mỗi chu kỳ (chung cho Tennis, Cầu lông, Bơi lội) theo hạng gói.
     *
     * Số lượt đặt sân bao gồm mỗi chu kỳ 30 ngày cho Tennis, Cầu lông và Bơi cộng lại, theo hạng gói.
     */
    public static int cycleQuota(com.swp391.scms.facilities.entity.MembershipPackage pkg) {
        return com.swp391.scms.facilities.PackageBenefits.courtBookingsPerCycle(pkg);
    }
}
