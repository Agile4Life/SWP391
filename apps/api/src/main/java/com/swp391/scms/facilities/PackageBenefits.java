package com.swp391.scms.facilities;

import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Nguồn duy nhất quy định quyền lợi của từng hạng gói hội viên (spec 2026-11-09-membership-benefits): mọi quyền lợi
 * được suy ra từ hạng gói (dự phòng theo tên) và thời hạn, không bao giờ kiểm tra tên rải rác.
 */
public final class PackageBenefits {
    /** Độ dài một chu kỳ quyền lợi: buổi PT, lượt đặt sân và các ưu đãi "theo tháng" làm mới mỗi 30 ngày kể từ ngày bắt đầu. */
    public static final int CYCLE_DAYS = 30;
    /** Các gói ngắn tới mức này là gói trải nghiệm 3 ngày. */
    public static final int TRIAL_MAX_DAYS = 3;
    private static final int LONG_TERM_MIN_DAYS = 60;

    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private PackageBenefits() {}

    /** Gói có phải gói trải nghiệm không (tên chứa "trải nghiệm"/"trial" hoặc dài tối đa 3 ngày). */
    public static boolean isTrial(MembershipPackage pkg) {
        if (pkg == null) return false;
        String name = pkg.getName() == null ? "" : pkg.getName().toUpperCase(Locale.ROOT);
        return name.contains("TRẢI NGHIỆM") || name.contains("TRAI NGHIEM") || name.contains("TRIAL")
                || (pkg.getDurationDays() > 0 && pkg.getDurationDays() <= TRIAL_MAX_DAYS);
    }

    /**
     * Hạng của gói: SILVER, GOLD hoặc PLATINUM. Gói trải nghiệm được tính là GOLD vì hưởng dịch vụ của hạng Gold.
     */
    public static String tierOf(MembershipPackage pkg) {
        if (pkg == null) return "SILVER";
        return PackageDto.inferTier(pkg.getName(), pkg.getTier());
    }

    /** Hạng của gói trả tiền; gói trải nghiệm trả null. */
    private static String paidTier(MembershipPackage pkg) {
        return pkg == null || isTrial(pkg) ? null : tierOf(pkg);
    }

    /**
     * Số khóa học nhóm miễn phí của gói (tính năng cũ): Silver 1, Gold 2, Platinum 4 mỗi chu kỳ 30 ngày; gói 3 tháng
     * được gấp ba lần hạn mức gói 1 tháng.
     */
    public static int courseCredits(String tier, int durationDays) {
        int base = switch (tier == null ? "" : tier) {
            case "SILVER" -> 1;
            case "GOLD" -> 2;
            case "PLATINUM" -> 4;
            default -> 0;
        };
        int cycles = Math.max(1, Math.round(durationDays / (float) CYCLE_DAYS));
        return base * cycles;
    }

    /**
     * Số buổi PT 1:1 miễn phí mỗi chu kỳ 30 ngày: Platinum 6, Gold 3, gói trải nghiệm 1, Silver 0.
     */
    public static int ptSessionsPerCycle(MembershipPackage pkg) {
        if (pkg == null) return 0;
        if (isTrial(pkg)) return 1;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 6;
            case "GOLD" -> 3;
            default -> 0;
        };
    }

    /**
     * Số lượt đặt sân miễn phí mỗi chu kỳ (tính năng cũ): Platinum 3, Gold 2, Silver 1, trải nghiệm 0.
     */
    public static int courtBookingsPerCycle(MembershipPackage pkg) {
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        return switch (tier) {
            case "PLATINUM" -> 3;
            case "GOLD" -> 2;
            default -> 1;
        };
    }

    /**
     * Số ngày tối đa hội viên được đặt sân trước (tính năng cũ): trải nghiệm 3, Silver 7, Gold 14, Platinum 30.
     */
    public static int courtAdvanceDays(MembershipPackage pkg) {
        if (pkg == null || isTrial(pkg)) return 3;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 30;
            case "GOLD" -> 14;
            default -> 7;
        };
    }

    /**
     * Số lượt đặt sân sắp tới tối đa hội viên được giữ cùng lúc, bất kể đã trả tiền hay chưa (tính năng cũ): trải
     * nghiệm 1, Silver 3, Gold 5, Platinum 8 (gồm lượt miễn phí theo gói, lượt giữ chưa trả và một lượt trả phí dự
     * phòng).
     */
    public static int courtMaxUpcoming(MembershipPackage pkg) {
        if (pkg == null || isTrial(pkg)) return 1;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 8;
            case "GOLD" -> 5;
            default -> 3;
        };
    }

    /**
     * Số khung sân hội viên được giữ cùng lúc khi chưa thanh toán (tại quầy hoặc VNPay, tính năng cũ): trải nghiệm 1,
     * Silver 1, Gold 2, Platinum 3 — nhằm chặn một tài khoản giữ quá nhiều khung mà không thanh toán.
     */
    public static int courtMaxUnpaidHolds(MembershipPackage pkg) {
        if (pkg == null || isTrial(pkg)) return 1;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 3;
            case "GOLD" -> 2;
            default -> 1;
        };
    }

    /**
     * Số ngày bảo lưu tối đa; 0 nghĩa là gói không được bảo lưu (Silver/Gold 1 tháng, gói trải nghiệm). Với gói dài
     * hạn (từ 60 ngày): Platinum 30, Gold 15, Silver 7; gói ngắn chỉ Platinum được 7 ngày.
     */
    public static int holdMaxDays(MembershipPackage pkg) {
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        boolean longTerm = pkg.getDurationDays() >= LONG_TERM_MIN_DAYS;
        if (!longTerm) return "PLATINUM".equals(tier) ? 7 : 0;
        return switch (tier) {
            case "PLATINUM" -> 30;
            case "GOLD" -> 15;
            default -> 7;
        };
    }

    /**
     * Phần trăm giảm giá cho buổi PT thêm, học phí khóa học trả phí và sản phẩm cửa hàng: Gold 10, Platinum 20, còn
     * lại 0.
     */
    public static int discountPercent(MembershipPackage pkg) {
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        return switch (tier) {
            case "PLATINUM" -> 20;
            case "GOLD" -> 10;
            default -> 0;
        };
    }

    /** Có quyền vào phòng VIP không (chỉ Platinum trả tiền). */
    public static boolean hasVipRoomAccess(MembershipPackage pkg) {
        return "PLATINUM".equals(paidTier(pkg));
    }

    /**
     * Có được đánh giá chuyên sâu (tỷ lệ mỡ, khối lượng cơ) không: chỉ dành cho hạng Platinum (gói trải nghiệm không
     * phải Platinum).
     */
    public static boolean allowsDeepAssessment(MembershipPackage pkg) {
        return hasVipRoomAccess(pkg);
    }

    /**
     * Có được đánh giá định kỳ hằng tháng không: bắt đầu từ Gold (Silver chỉ có lần đánh giá đầu tiên; gói trải nghiệm
     * áp dụng theo Gold).
     */
    public static boolean allowsPeriodicAssessment(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /**
     * Có được xem giáo án HLV soạn không: hội viên Silver không thấy giáo án; gói trải nghiệm áp dụng theo Gold.
     */
    public static boolean canViewWorkoutPlan(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /**
     * Ngày gốc dùng để đếm các chu kỳ quyền lợi: ngày bắt đầu của kỳ gói, hoặc với gói nâng cấp thì là ngày bắt đầu
     * của gói bị thay thế — để việc nâng cấp giữa chu kỳ không bao giờ cấp thêm hạn mức PT, đặt sân hay khóa học mới.
     */
    public static LocalDate cycleAnchor(com.swp391.scms.membership.entity.MembershipSubscription subscription) {
        var current = subscription;
        java.util.Set<Long> seen = new java.util.HashSet<>();
        while (current.getUpgradeCharge() != null && current.getPreviousSubscription() != null
                && current.getId() != null && seen.add(current.getId())) {
            current = current.getPreviousSubscription();
        }
        return current.getStartDate();
    }

    /** Kỳ gói có bảo lưu có ngày cụ thể đã duyệt (và không phải kỳ nâng cấp) không. */
    private static boolean hasDatedHold(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        return sub.isHoldUsed() && sub.getHoldStartDate() != null && sub.getHoldEndDate() != null
                && sub.getStartDate() != null && sub.getStartDate().equals(cycleAnchor(sub));
    }

    /**
     * Số ngày của đồng hồ chu kỳ đã trôi tới {@code date}: các ngày bảo lưu không được tính, nên bảo lưu không làm
     * hao hụt chu kỳ.
     */
    private static long effectiveDays(LocalDate anchor, LocalDate holdStart, LocalDate holdEnd, LocalDate date) {
        long gap = Math.max(0, ChronoUnit.DAYS.between(anchor, holdStart));
        if (date.isBefore(holdStart)) return Math.max(0, ChronoUnit.DAYS.between(anchor, date));
        if (!date.isAfter(holdEnd)) return gap;
        return ChronoUnit.DAYS.between(anchor, date) - (ChronoUnit.DAYS.between(holdStart, holdEnd) + 1);
    }

    /**
     * Ngày thực tế tương ứng với ngày chu kỳ hiệu lực thứ {@code offset}: các ngày từ lúc bảo lưu trở đi được đẩy lùi
     * thêm đúng độ dài đợt bảo lưu.
     */
    private static LocalDate realDate(LocalDate anchor, LocalDate holdStart, LocalDate holdEnd, long offset) {
        long gap = Math.max(0, ChronoUnit.DAYS.between(anchor, holdStart));
        long holdLength = ChronoUnit.DAYS.between(holdStart, holdEnd) + 1;
        return offset < gap ? anchor.plusDays(offset) : anchor.plusDays(offset + holdLength);
    }

    /**
     * Ngày bắt đầu chu kỳ quyền lợi chứa {@code date} của một kỳ gói: tính từ ngày bắt đầu (hoặc ngày bắt đầu của gói
     * bị thay thế khi nâng cấp) và, khi đã có bảo lưu được duyệt, không tính các ngày bảo lưu.
     */
    public static LocalDate cycleStart(com.swp391.scms.membership.entity.MembershipSubscription sub, LocalDate date) {
        LocalDate anchor = cycleAnchor(sub);
        if (!hasDatedHold(sub)) return cycleStart(anchor, date);
        long cycle = effectiveDays(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), date) / CYCLE_DAYS;
        return realDate(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), cycle * CYCLE_DAYS);
    }

    /**
     * Ngày cuối của chu kỳ đó, không bao giờ vượt quá ngày kết thúc kỳ gói.
     */
    public static LocalDate cycleEnd(com.swp391.scms.membership.entity.MembershipSubscription sub, LocalDate date) {
        LocalDate anchor = cycleAnchor(sub);
        if (!hasDatedHold(sub)) return cycleEnd(anchor, sub.getEndDate(), date);
        long cycle = effectiveDays(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), date) / CYCLE_DAYS;
        LocalDate end = realDate(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), cycle * CYCLE_DAYS + CYCLE_DAYS - 1);
        return sub.getEndDate() != null && end.isAfter(sub.getEndDate()) ? sub.getEndDate() : end;
    }

    /**
     * Ngày bắt đầu chu kỳ 30 ngày chứa {@code date}, tính từ ngày bắt đầu kỳ gói.
     */
    public static LocalDate cycleStart(LocalDate subscriptionStart, LocalDate date) {
        long days = Math.max(0, ChronoUnit.DAYS.between(subscriptionStart, date));
        return subscriptionStart.plusDays((days / CYCLE_DAYS) * CYCLE_DAYS);
    }

    /**
     * Ngày cuối của chu kỳ chứa {@code date}, không bao giờ vượt quá ngày kết thúc kỳ gói.
     */
    public static LocalDate cycleEnd(LocalDate subscriptionStart, LocalDate subscriptionEnd, LocalDate date) {
        LocalDate end = cycleStart(subscriptionStart, date).plusDays(CYCLE_DAYS - 1L);
        return subscriptionEnd != null && end.isAfter(subscriptionEnd) ? subscriptionEnd : end;
    }
}
