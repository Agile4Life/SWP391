package com.swp391.scms.facilities;

import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Nguồn duy nhất quy định quyền lợi của từng hạng gói (Silver/Gold/Platinum và gói trải nghiệm): suy ra từ hạng
 * gói (hoặc tên) và thời hạn, không kiểm tra tên rải rác.
 *
 * Single source of truth for what each membership tier includes (spec 2026-11-09-membership-benefits).
 * Everything is derived from the package tier (falling back to the name) and its duration, never from ad-hoc name checks.
 */
public final class PackageBenefits {
    /** Length of one benefit cycle: PT sessions, court bookings and "monthly" perks reset every 30 days from the start date. */
    public static final int CYCLE_DAYS = 30;
    /** Packages this short are the 3-day trial. */
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
     * Hạng của gói: SILVER, GOLD hoặc PLATINUM (gói trải nghiệm được tính là GOLD vì hưởng dịch vụ Gold).
     *
     * SILVER, GOLD or PLATINUM. The trial is reported as GOLD because it receives Gold services.
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
     * Số khóa học nhóm miễn phí của gói (tính năng cũ): Silver 1, Gold 2, Platinum 4 mỗi 30 ngày, nhân theo số
     * tháng.
     *
     * Free group-fitness courses per package; the 3-month packages get three times the 1-month allowance.
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
     *
     * Free 1:1 PT sessions per cycle: Gold 3, Platinum 6, trial 1, Silver none.
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
     *
     * Included court bookings per cycle: Platinum 3, Gold 2, Silver 1, trial none.
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
     * Số ngày được đặt sân trước (tính năng cũ): trải nghiệm 3, Silver 7, Gold 14, Platinum 30.
     *
     * How many days ahead a member may book a court: trial 3, Silver 7, Gold 14, Platinum 30.
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
     * Số lượt đặt sân sắp tới tối đa cùng lúc (tính năng cũ): trải nghiệm 1, Silver 3, Gold 5, Platinum 8.
     *
     * Upcoming court bookings a member may have at once, paid or not: trial 1, Silver 3, Gold 5, Platinum 8
     * (the plan's included bookings, the unpaid holds, and one paid booking of headroom).
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
     * Số sân được giữ mà chưa trả tiền cùng lúc (tính năng cũ): trải nghiệm/Silver 1, Gold 2, Platinum 3.
     *
     * Court slots a member may hold at once without having paid for them (counter or VNPay): trial 1, Silver 1,
     * Gold 2, Platinum 3. Stops one account from reserving many slots it never pays for.
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
     * Số ngày bảo lưu tối đa; 0 nghĩa là không được bảo lưu. Gói dài hạn (từ 60 ngày): Platinum 30, Gold 15,
     * Silver 7; gói ngắn: chỉ Platinum 7; gói trải nghiệm không bảo lưu.
     *
     * Longest hold in days; 0 means the package cannot be held (1-month Silver/Gold, trial).
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
     * Phần trăm giảm giá cho buổi PT thêm và các khoản phí: Platinum 20, Gold 10, còn lại 0.
     *
     * Percent off extra PT sessions, paid course fees and shop products: Gold 10, Platinum 20.
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
     * Có được đánh giá chuyên sâu (mỡ, cơ) không (chỉ Platinum).
     *
     * Body Fat and Muscle Mass (the in-depth assessment) are a Platinum service; the trial is not Platinum.
     */
    public static boolean allowsDeepAssessment(MembershipPackage pkg) {
        return hasVipRoomAccess(pkg);
    }

    /**
     * Có được đánh giá định kỳ hằng tháng không (từ Gold trở lên, gói trải nghiệm như Gold).
     *
     * Monthly follow-up assessments start at Gold; Silver gets the first assessment only. The trial follows Gold.
     */
    public static boolean allowsPeriodicAssessment(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /**
     * Có được xem giáo án HLV soạn không (Silver không được).
     *
     * Silver members do not see the workout plans their coach writes. The trial follows Gold.
     */
    public static boolean canViewWorkoutPlan(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /**
     * Ngày bắt đầu tính chu kỳ quyền lợi: ngày bắt đầu kỳ gói, hoặc với kỳ nâng cấp thì là ngày bắt đầu của gói
     * bị thay thế, để nâng cấp giữa chu kỳ không được cấp lại quyền lợi mới.
     *
     * The date benefit cycles are counted from: the start of the subscription, or for an upgrade the start of the plan
     * it replaced, so upgrading mid-cycle never hands out a fresh PT, court or course allowance.
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
     * Số ngày của đồng hồ chu kỳ đã trôi tới ngày cho trước, không tính các ngày bảo lưu (bảo lưu không làm mất
     * chu kỳ).
     *
     * Days of the cycle clock that have run by {@code date}: held days do not count, so a hold never eats a cycle.
     */
    private static long effectiveDays(LocalDate anchor, LocalDate holdStart, LocalDate holdEnd, LocalDate date) {
        long gap = Math.max(0, ChronoUnit.DAYS.between(anchor, holdStart));
        if (date.isBefore(holdStart)) return Math.max(0, ChronoUnit.DAYS.between(anchor, date));
        if (!date.isAfter(holdEnd)) return gap;
        return ChronoUnit.DAYS.between(anchor, date) - (ChronoUnit.DAYS.between(holdStart, holdEnd) + 1);
    }

    /**
     * Ngày thật ứng với ngày thứ offset của đồng hồ chu kỳ: các ngày từ lúc bảo lưu trở đi bị lùi thêm số ngày
     * bảo lưu.
     *
     * Real date of the effective cycle day {@code offset}: days at or after the hold are pushed back by its length.
     */
    private static LocalDate realDate(LocalDate anchor, LocalDate holdStart, LocalDate holdEnd, long offset) {
        long gap = Math.max(0, ChronoUnit.DAYS.between(anchor, holdStart));
        long holdLength = ChronoUnit.DAYS.between(holdStart, holdEnd) + 1;
        return offset < gap ? anchor.plusDays(offset) : anchor.plusDays(offset + holdLength);
    }

    /**
     * Ngày bắt đầu chu kỳ quyền lợi chứa ngày cho trước của kỳ gói (tính từ ngày neo, bỏ qua ngày bảo lưu nếu
     * có).
     *
     * Start of the benefit cycle containing {@code date} for a subscription: counted from its start (or the plan an
     * upgrade replaced) and, once a hold has been approved, not counting the held days.
     */
    public static LocalDate cycleStart(com.swp391.scms.membership.entity.MembershipSubscription sub, LocalDate date) {
        LocalDate anchor = cycleAnchor(sub);
        if (!hasDatedHold(sub)) return cycleStart(anchor, date);
        long cycle = effectiveDays(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), date) / CYCLE_DAYS;
        return realDate(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), cycle * CYCLE_DAYS);
    }

    /**
     * Ngày cuối chu kỳ đó, không vượt quá ngày kết thúc kỳ gói.
     *
     * Last day of that cycle, never past the end of the subscription.
     */
    public static LocalDate cycleEnd(com.swp391.scms.membership.entity.MembershipSubscription sub, LocalDate date) {
        LocalDate anchor = cycleAnchor(sub);
        if (!hasDatedHold(sub)) return cycleEnd(anchor, sub.getEndDate(), date);
        long cycle = effectiveDays(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), date) / CYCLE_DAYS;
        LocalDate end = realDate(anchor, sub.getHoldStartDate(), sub.getHoldEndDate(), cycle * CYCLE_DAYS + CYCLE_DAYS - 1);
        return sub.getEndDate() != null && end.isAfter(sub.getEndDate()) ? sub.getEndDate() : end;
    }

    /**
     * Ngày bắt đầu chu kỳ 30 ngày chứa ngày cho trước, tính từ ngày bắt đầu kỳ gói.
     *
     * Start of the 30-day cycle that contains {@code date}, counted from the subscription start.
     */
    public static LocalDate cycleStart(LocalDate subscriptionStart, LocalDate date) {
        long days = Math.max(0, ChronoUnit.DAYS.between(subscriptionStart, date));
        return subscriptionStart.plusDays((days / CYCLE_DAYS) * CYCLE_DAYS);
    }

    /**
     * Ngày cuối chu kỳ chứa ngày cho trước, không vượt quá ngày kết thúc kỳ gói.
     *
     * Last day of the cycle that contains {@code date}, never past the subscription end.
     */
    public static LocalDate cycleEnd(LocalDate subscriptionStart, LocalDate subscriptionEnd, LocalDate date) {
        LocalDate end = cycleStart(subscriptionStart, date).plusDays(CYCLE_DAYS - 1L);
        return subscriptionEnd != null && end.isAfter(subscriptionEnd) ? subscriptionEnd : end;
    }
}
