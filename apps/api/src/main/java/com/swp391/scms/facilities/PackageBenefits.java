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
    /** Độ dài một chu kỳ quyền lợi: buổi PT và các ưu đãi "theo tháng" làm mới mỗi 30 ngày kể từ ngày bắt đầu. */
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
     * Số buổi PT 1:1 miễn phí mỗi chu kỳ 30 ngày: ưu tiên cấu hình riêng trên gói nếu có; mặc định theo hạng
     * Platinum 6, Gold 3, gói trải nghiệm 1, Silver 0.
     */
    public static int ptSessionsPerCycle(MembershipPackage pkg) {
        if (pkg == null) return 0;
        if (pkg.getPtSessionsPerCycle() != null) return Math.max(0, pkg.getPtSessionsPerCycle());
        if (isTrial(pkg)) return 1;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 6;
            case "GOLD" -> 3;
            default -> 0;
        };
    }

    /** Số buổi PT 1:1 miễn phí mỗi chu kỳ 30 ngày của một kỳ gói (ưu tiên snapshot lúc mua). */
    public static int ptSessionsPerCycle(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return 0;
        if (sub.getSnapshotPtSessionsPerCycle() != null) return Math.max(0, sub.getSnapshotPtSessionsPerCycle());
        return ptSessionsPerCycle(sub.getMembershipPackage());
    }

    /**
     * Số ngày bảo lưu tối đa; 0 nghĩa là gói không được bảo lưu. Ưu tiên cấu hình riêng trên gói nếu có; mặc định
     * gói dài hạn (>= 60 ngày): Platinum 30, Gold 15, Silver 7; gói ngắn chỉ Platinum 7 ngày.
     */
    public static int holdMaxDays(MembershipPackage pkg) {
        if (pkg == null) return 0;
        if (pkg.getHoldMaxDays() != null) return Math.max(0, pkg.getHoldMaxDays());
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

    /** Số ngày bảo lưu tối đa của một kỳ gói (ưu tiên snapshot lúc mua). */
    public static int holdMaxDays(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return 0;
        if (sub.getSnapshotHoldMaxDays() != null) return Math.max(0, sub.getSnapshotHoldMaxDays());
        return holdMaxDays(sub.getMembershipPackage());
    }

    /**
     * Phần trăm giảm giá cho buổi PT thêm, học phí khóa học trả phí: ưu tiên cấu hình riêng trên gói nếu có; mặc
     * định Gold 10, Platinum 20, còn lại 0.
     */
    public static int discountPercent(MembershipPackage pkg) {
        if (pkg == null) return 0;
        if (pkg.getDiscountPercent() != null) return Math.max(0, Math.min(100, pkg.getDiscountPercent()));
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        return switch (tier) {
            case "PLATINUM" -> 20;
            case "GOLD" -> 10;
            default -> 0;
        };
    }

    /** Phần trăm giảm giá của một kỳ gói (ưu tiên snapshot lúc mua). */
    public static int discountPercent(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return 0;
        if (sub.getSnapshotDiscountPercent() != null) return Math.max(0, Math.min(100, sub.getSnapshotDiscountPercent()));
        return discountPercent(sub.getMembershipPackage());
    }

    /** Có quyền vào phòng VIP không (ưu tiên cấu hình riêng trên gói; mặc định chỉ Platinum trả tiền). */
    public static boolean hasVipRoomAccess(MembershipPackage pkg) {
        if (pkg == null) return false;
        if (pkg.getVipRoomAccess() != null) return pkg.getVipRoomAccess();
        return "PLATINUM".equals(paidTier(pkg));
    }

    /** Có quyền vào phòng VIP cho kỳ gói không (ưu tiên snapshot lúc mua). */
    public static boolean hasVipRoomAccess(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getSnapshotVipRoomAccess() != null) return sub.getSnapshotVipRoomAccess();
        return hasVipRoomAccess(sub.getMembershipPackage());
    }

    /**
     * Có được đánh giá chuyên sâu (tỷ lệ mỡ, khối lượng cơ) không: ưu tiên cấu hình riêng trên gói; mặc định chỉ
     * dành cho hạng Platinum trả tiền.
     */
    public static boolean allowsDeepAssessment(MembershipPackage pkg) {
        if (pkg == null) return false;
        if (pkg.getAllowsDeepAssessment() != null) return pkg.getAllowsDeepAssessment();
        return "PLATINUM".equals(paidTier(pkg));
    }

    /** Có được đánh giá chuyên sâu cho kỳ gói không (ưu tiên snapshot lúc mua). */
    public static boolean allowsDeepAssessment(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getSnapshotAllowsDeepAssessment() != null) return sub.getSnapshotAllowsDeepAssessment();
        return allowsDeepAssessment(sub.getMembershipPackage());
    }

    /**
     * Có được đánh giá định kỳ hằng tháng không: ưu tiên cấu hình riêng trên gói; mặc định từ Gold trở lên.
     */
    public static boolean allowsPeriodicAssessment(MembershipPackage pkg) {
        if (pkg == null) return false;
        if (pkg.getAllowsPeriodicAssessment() != null) return pkg.getAllowsPeriodicAssessment();
        return !"SILVER".equals(tierOf(pkg));
    }

    /** Có được đánh giá định kỳ cho kỳ gói không (ưu tiên snapshot lúc mua). */
    public static boolean allowsPeriodicAssessment(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getSnapshotAllowsPeriodicAssessment() != null) return sub.getSnapshotAllowsPeriodicAssessment();
        return allowsPeriodicAssessment(sub.getMembershipPackage());
    }

    /**
     * Có được xem giáo án HLV soạn không: ưu tiên cấu hình riêng trên gói; mặc định từ Gold trở lên.
     */
    public static boolean canViewWorkoutPlan(MembershipPackage pkg) {
        if (pkg == null) return false;
        if (pkg.getCanViewWorkoutPlan() != null) return pkg.getCanViewWorkoutPlan();
        return !"SILVER".equals(tierOf(pkg));
    }

    /** Có được xem giáo án HLV soạn cho kỳ gói không (ưu tiên snapshot lúc mua). */
    public static boolean canViewWorkoutPlan(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getSnapshotCanViewWorkoutPlan() != null) return sub.getSnapshotCanViewWorkoutPlan();
        return canViewWorkoutPlan(sub.getMembershipPackage());
    }

    /** Hạn mức số lượt đăng ký khóa học nhóm của kỳ gói (ưu tiên snapshot lúc mua). */
    public static Integer classCreditLimit(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return null;
        if (sub.getSnapshotClassCreditLimit() != null) return sub.getSnapshotClassCreditLimit();
        return sub.getMembershipPackage() != null ? sub.getMembershipPackage().getClassCreditLimit() : null;
    }

    /** Tên gói của kỳ gói (ưu tiên snapshot lúc mua để đổi tên gói ở danh mục không làm sai lịch sử). */
    public static String packageName(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return null;
        if (sub.getSnapshotPackageName() != null && !sub.getSnapshotPackageName().isBlank()) {
            return sub.getSnapshotPackageName();
        }
        return sub.getMembershipPackage() != null ? sub.getMembershipPackage().getName() : null;
    }

    /** Hạng gói của kỳ gói (ưu tiên snapshot lúc mua). */
    public static String packageTier(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return "SILVER";
        if (sub.getSnapshotPackageTier() != null && !sub.getSnapshotPackageTier().isBlank()) {
            return sub.getSnapshotPackageTier();
        }
        return tierOf(sub.getMembershipPackage());
    }

    /** Lưu bản sao tên, hạng và quyền lợi của gói vào kỳ gói lúc hội viên đăng ký/gia hạn/nâng cấp. */
    public static void snapshotTo(com.swp391.scms.membership.entity.MembershipSubscription sub, MembershipPackage pkg) {
        if (sub == null || pkg == null) return;
        sub.setSnapshotPackageName(pkg.getName());
        sub.setSnapshotPackageTier(tierOf(pkg));
        sub.setSnapshotClassCreditLimit(pkg.getClassCreditLimit());
        sub.setSnapshotPtSessionsPerCycle(ptSessionsPerCycle(pkg));
        sub.setSnapshotHoldMaxDays(holdMaxDays(pkg));
        sub.setSnapshotDiscountPercent(discountPercent(pkg));
        sub.setSnapshotVipRoomAccess(hasVipRoomAccess(pkg));
        sub.setSnapshotCanViewWorkoutPlan(canViewWorkoutPlan(pkg));
        sub.setSnapshotAllowsPeriodicAssessment(allowsPeriodicAssessment(pkg));
        sub.setSnapshotAllowsDeepAssessment(allowsDeepAssessment(pkg));
    }

    /**
     * Kỳ gói có phải gói trải nghiệm không (theo gói hoặc kỳ không nâng cấp, chưa hết hạn dài tối đa 3 ngày).
     */
    public static boolean isTrialSubscription(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return false;
        if (isTrial(sub.getMembershipPackage())) return true;
        if (sub.getUpgradeCharge() == null && !"expired".equalsIgnoreCase(sub.getStatus())
                && sub.getStartDate() != null && sub.getEndDate() != null) {
            long days = ChronoUnit.DAYS.between(sub.getStartDate(), sub.getEndDate());
            return days >= 0 && days <= TRIAL_MAX_DAYS;
        }
        return false;
    }

    /**
     * Tổng số buổi PT 1:1 miễn phí tối đa trong toàn bộ thời hạn đã mua của một kỳ gói, nhằm ngăn trường hợp nâng cấp
     * giữa chu kỳ tạo thêm chu kỳ lẻ và nhân đôi hạn mức (ví dụ gói Platinum 30 ngày tối đa 6 buổi).
     */
    public static int totalPtSessions(com.swp391.scms.membership.entity.MembershipSubscription sub) {
        if (sub == null) return 0;
        if (isTrialSubscription(sub)) return 1;
        int perCycle = ptSessionsPerCycle(sub);
        if (perCycle <= 0) return 0;
        int durationDays = sub.getMembershipPackage() != null ? sub.getMembershipPackage().getDurationDays() : 0;
        if (durationDays <= 0 && sub.getStartDate() != null && sub.getEndDate() != null) {
            durationDays = (int) Math.max(1, ChronoUnit.DAYS.between(sub.getStartDate(), sub.getEndDate()) + 1);
        }
        int expectedCycles = Math.max(1, (int) Math.ceil(durationDays / (double) CYCLE_DAYS));
        return perCycle * expectedCycles;
    }

    /**
     * Ngày gốc dùng để đếm các chu kỳ quyền lợi: ngày bắt đầu của kỳ gói, hoặc với gói nâng cấp thì là ngày bắt đầu
     * của gói trả phí bị thay thế (dừng trước gói trải nghiệm) — để việc nâng cấp giữa chu kỳ không bao giờ cấp thêm
     * hạn mức PT hay khóa học mới.
     */
    public static LocalDate cycleAnchor(com.swp391.scms.membership.entity.MembershipSubscription subscription) {
        var current = subscription;
        java.util.Set<Long> seen = new java.util.HashSet<>();
        while (current.getUpgradeCharge() != null && current.getPreviousSubscription() != null
                && !isTrialSubscription(current.getPreviousSubscription())
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
