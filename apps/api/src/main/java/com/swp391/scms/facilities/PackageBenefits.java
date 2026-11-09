package com.swp391.scms.facilities;

import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Single source of truth for what each membership tier includes (spec 2026-11-09-membership-benefits).
 * Everything is derived from the package tier (falling back to the name) and its duration, never from ad-hoc name checks.
 */
public final class PackageBenefits {
    /** Length of one benefit cycle: PT sessions, court bookings and "monthly" perks reset every 30 days from the start date. */
    public static final int CYCLE_DAYS = 30;
    /** Packages this short are the 3-day trial. */
    public static final int TRIAL_MAX_DAYS = 3;
    private static final int LONG_TERM_MIN_DAYS = 60;

    private PackageBenefits() {}

    public static boolean isTrial(MembershipPackage pkg) {
        if (pkg == null) return false;
        String name = pkg.getName() == null ? "" : pkg.getName().toUpperCase(Locale.ROOT);
        return name.contains("TRẢI NGHIỆM") || name.contains("TRAI NGHIEM") || name.contains("TRIAL")
                || (pkg.getDurationDays() > 0 && pkg.getDurationDays() <= TRIAL_MAX_DAYS);
    }

    /** SILVER, GOLD or PLATINUM. The trial is reported as GOLD because it receives Gold services. */
    public static String tierOf(MembershipPackage pkg) {
        if (pkg == null) return "SILVER";
        return PackageDto.inferTier(pkg.getName(), pkg.getTier());
    }

    private static String paidTier(MembershipPackage pkg) {
        return pkg == null || isTrial(pkg) ? null : tierOf(pkg);
    }

    /** Free group-fitness courses per package; the 3-month packages get three times the 1-month allowance. */
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

    /** Free 1:1 PT sessions per cycle: Gold 3, Platinum 6, trial 1, Silver none. */
    public static int ptSessionsPerCycle(MembershipPackage pkg) {
        if (pkg == null) return 0;
        if (isTrial(pkg)) return 1;
        return switch (tierOf(pkg)) {
            case "PLATINUM" -> 6;
            case "GOLD" -> 3;
            default -> 0;
        };
    }

    /** Included court bookings per cycle: Platinum 3, Gold 2, Silver 1, trial none. */
    public static int courtBookingsPerCycle(MembershipPackage pkg) {
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        return switch (tier) {
            case "PLATINUM" -> 3;
            case "GOLD" -> 2;
            default -> 1;
        };
    }

    /** Longest hold in days; 0 means the package cannot be held (1-month Silver/Gold, trial). */
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

    /** Percent off extra PT sessions, paid course fees and shop products: Gold 10, Platinum 20. */
    public static int discountPercent(MembershipPackage pkg) {
        String tier = paidTier(pkg);
        if (tier == null) return 0;
        return switch (tier) {
            case "PLATINUM" -> 20;
            case "GOLD" -> 10;
            default -> 0;
        };
    }

    public static boolean hasVipRoomAccess(MembershipPackage pkg) {
        return "PLATINUM".equals(paidTier(pkg));
    }

    /** Body Fat and Muscle Mass (the in-depth assessment) are a Platinum service; the trial is not Platinum. */
    public static boolean allowsDeepAssessment(MembershipPackage pkg) {
        return hasVipRoomAccess(pkg);
    }

    /** Monthly follow-up assessments start at Gold; Silver gets the first assessment only. The trial follows Gold. */
    public static boolean allowsPeriodicAssessment(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /** Silver members do not see the workout plans their coach writes. The trial follows Gold. */
    public static boolean canViewWorkoutPlan(MembershipPackage pkg) {
        return pkg != null && !"SILVER".equals(tierOf(pkg));
    }

    /** Start of the 30-day cycle that contains {@code date}, counted from the subscription start. */
    public static LocalDate cycleStart(LocalDate subscriptionStart, LocalDate date) {
        long days = Math.max(0, ChronoUnit.DAYS.between(subscriptionStart, date));
        return subscriptionStart.plusDays((days / CYCLE_DAYS) * CYCLE_DAYS);
    }

    /** Last day of the cycle that contains {@code date}, never past the subscription end. */
    public static LocalDate cycleEnd(LocalDate subscriptionStart, LocalDate subscriptionEnd, LocalDate date) {
        LocalDate end = cycleStart(subscriptionStart, date).plusDays(CYCLE_DAYS - 1L);
        return subscriptionEnd != null && end.isAfter(subscriptionEnd) ? subscriptionEnd : end;
    }
}
