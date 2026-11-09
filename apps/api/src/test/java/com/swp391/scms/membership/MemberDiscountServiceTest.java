package com.swp391.scms.membership;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MemberDiscountService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class MemberDiscountServiceTest {
    private final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final MemberDiscountService service = new MemberDiscountService(subscriptions, clock);

    private MembershipSubscription sub(String name, String tier, int days, LocalDate start, LocalDate end) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName(name);
        pkg.setTier(tier);
        pkg.setDurationDays(days);
        MembershipSubscription s = new MembershipSubscription();
        s.setMembershipPackage(pkg);
        s.setStatus("active");
        s.setStartDate(start);
        s.setEndDate(end);
        return s;
    }

    @Test
    void goldGetsTenPercentPlatinumTwentyAndSilverAndTrialNothing() {
        LocalDate today = LocalDate.of(2026, 11, 9);
        when(subscriptions.findByMemberUserIdAndStatus(1L, "active")).thenReturn(List.of(sub("GOLD", "GOLD", 30, today.minusDays(3), today.plusDays(26))));
        when(subscriptions.findByMemberUserIdAndStatus(2L, "active")).thenReturn(List.of(sub("PLATINUM 3 THÁNG", "PLATINUM", 90, today.minusDays(3), today.plusDays(86))));
        when(subscriptions.findByMemberUserIdAndStatus(3L, "active")).thenReturn(List.of(sub("SILVER", "SILVER", 30, today.minusDays(3), today.plusDays(26))));
        when(subscriptions.findByMemberUserIdAndStatus(4L, "active")).thenReturn(List.of(sub("Gói Trải Nghiệm 3 Ngày", "GOLD", 3, today, today.plusDays(2))));

        assertThat(service.percentFor(1L)).isEqualTo(10);
        assertThat(service.percentFor(2L)).isEqualTo(20);
        assertThat(service.percentFor(3L)).isZero();
        assertThat(service.percentFor(4L)).isZero();
        assertThat(service.percentFor(null)).isZero();
    }

    @Test
    void anExpiredOrFuturePeriodDoesNotCount() {
        LocalDate today = LocalDate.of(2026, 11, 9);
        when(subscriptions.findByMemberUserIdAndStatus(1L, "active")).thenReturn(List.of(
                sub("PLATINUM", "PLATINUM", 30, today.minusDays(40), today.minusDays(10)),
                sub("PLATINUM", "PLATINUM", 30, today.plusDays(1), today.plusDays(30))));

        assertThat(service.percentFor(1L)).isZero();
    }

    @Test
    void amountsAreRoundedToWholeDongAndNeverGoNegative() {
        assertThat(MemberDiscountService.apply(new BigDecimal("200000"), 10)).isEqualByComparingTo("180000");
        assertThat(MemberDiscountService.apply(new BigDecimal("199000"), 20)).isEqualByComparingTo("159200");
        assertThat(MemberDiscountService.discountOf(new BigDecimal("333"), 10)).isEqualByComparingTo("33");
        assertThat(MemberDiscountService.apply(new BigDecimal("500000"), 0)).isEqualByComparingTo("500000");
        assertThat(MemberDiscountService.apply(BigDecimal.ZERO, 20)).isEqualByComparingTo("0");
    }
}
