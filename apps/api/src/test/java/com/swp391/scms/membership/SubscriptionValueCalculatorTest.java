package com.swp391.scms.membership;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.service.SubscriptionValueCalculator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho SubscriptionValueCalculator (subscription value calculator). */
class SubscriptionValueCalculatorTest {

    private static final LocalDate START = LocalDate.of(2026, 11, 1);

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final SubscriptionValueCalculator calculator = new SubscriptionValueCalculator(payments);

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (period). */
    private MembershipSubscription period(String listPrice) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setId(1L);
        pkg.setPrice(new BigDecimal(listPrice));
        pkg.setDurationDays(30);
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setId(7L);
        subscription.setMembershipPackage(pkg);
        subscription.setStartDate(START);
        subscription.setEndDate(START.plusDays(29));
        return subscription;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (payment). */
    private static Payment payment(String amount, String status, String refunded) {
        Payment payment = new Payment();
        payment.setSubscriptionId(7L);
        payment.setAmount(new BigDecimal(amount));
        payment.setStatus(status);
        if (refunded != null) payment.setRefundedAmount(new BigDecimal(refunded));
        return payment;
    }

    /** Kiểm thử: tín dụng giảm tuyến tính, không có bước nhảy ở nửa thời hạn. */
    @Test
    void creditFallsLinearlyWithNoCliffAtHalfTerm() {
        MembershipSubscription silver = period("199000");
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of(payment("199000", "success", null)));

        assertThat(calculator.remainingValue(silver, START)).isEqualByComparingTo("199000");
        assertThat(calculator.remainingValue(silver, START.plusDays(14))).isEqualByComparingTo("106000");
        assertThat(calculator.remainingValue(silver, START.plusDays(15))).isEqualByComparingTo("99000");
        assertThat(calculator.remainingValue(silver, START.plusDays(16))).isEqualByComparingTo("92000");
        assertThat(calculator.remainingValue(silver, START.plusDays(29))).isEqualByComparingTo("6000");
        assertThat(calculator.remainingValue(silver, START.plusDays(30))).isEqualByComparingTo("0");
        assertThat(calculator.remainingValue(silver, START.minusDays(3))).isEqualByComparingTo("199000");
    }

    /** Kiểm thử: giá trị lấy từ khoản thanh toán chứ không phải giá danh mục hiện tại. */
    @Test
    void valueComesFromPaymentsNotTheCurrentCatalogPrice() {
        MembershipSubscription silver = period("349000");
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of(
                payment("199000", "success", "50000"),
                payment("199000", "failed", null),
                payment("199000", "pending", null)));

        // 199,000 paid minus a 50,000 partial refund; failed/pending attempts and the repriced 349,000 do not count.
        assertThat(calculator.paidValue(silver)).isEqualByComparingTo("149000");
    }

    /** Kiểm thử: kỳ nâng cấp có giá trị bằng khoản phí cộng tín dụng mang sang. */
    @Test
    void upgradedPeriodIsWorthItsChargePlusTheCarriedCredit() {
        MembershipSubscription gold = period("599000");
        gold.setUpgradeCharge(new BigDecimal("200000"));
        gold.setCreditApplied(new BigDecimal("99000"));
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of(payment("200000", "success", null)));

        assertThat(calculator.paidValue(gold)).isEqualByComparingTo("299000");
        assertThat(calculator.remainingValue(gold, START.plusDays(15))).isEqualByComparingTo("149000");
    }

    /** Kiểm thử: nâng cấp cũ không lưu tín dụng thì dựng lại từ kỳ bị thay. */
    @Test
    void legacyUpgradeWithoutStoredCreditGetsItRebuiltFromTheReplacedPeriod() {
        // Silver bought 01/11 for 199,000 (30 days), upgraded on 17/11 under the old rule: full 299,000 paid.
        MembershipSubscription silver = period("249000");
        silver.setEndDate(START.plusDays(16));
        MembershipSubscription gold = period("399000");
        gold.setId(8L);
        gold.getMembershipPackage().setId(2L);
        gold.setPreviousSubscription(silver);
        gold.setStartDate(START.plusDays(16));
        gold.setEndDate(START.plusDays(45));
        gold.setReplacedEndDate(START.plusDays(29));
        gold.setUpgradeCharge(new BigDecimal("299000"));
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of(payment("199000", "success", null)));
        Payment goldPayment = payment("299000", "success", null);
        goldPayment.setSubscriptionId(8L);
        when(payments.findAllBySubscriptionId(8L)).thenReturn(List.of(goldPayment));

        // 14 of Silver's original 30 days were left on 17/11: 199,000 × 14/30 = 92,866 -> 92,000, on top of 299,000.
        // Repriced catalog prices (249,000 / 399,000) play no part.
        assertThat(calculator.paidValue(gold)).isEqualByComparingTo("391000");
    }

    /** Kiểm thử: gói dùng thử không có thanh toán thì không có giá trị. */
    @Test
    void trialWithoutPaymentIsWorthNothing() {
        MembershipSubscription trial = period("299000");
        trial.setUpgradeCharge(BigDecimal.ZERO);
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of());

        assertThat(calculator.remainingValue(trial, START)).isEqualByComparingTo("0");
    }

    /** Kiểm thử: phí nâng cấp bằng giá gói đích trừ tín dụng. */
    @Test
    void upgradeChargeIsTargetPriceMinusCredit() {
        assertThat(SubscriptionValueCalculator.upgradeCharge(new BigDecimal("299000"), new BigDecimal("99000")))
                .isEqualByComparingTo("200000");
        assertThat(SubscriptionValueCalculator.upgradeCharge(new BigDecimal("299000"), new BigDecimal("320000")).signum())
                .isNegative();
    }
}
