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

        // Đã trả 199.000 trừ 50.000 hoàn một phần; các lần thử failed/pending và giá mới 349.000 không được tính.
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
        // Gói Silver mua ngày 01/11 giá 199.000 (30 ngày), nâng cấp ngày 17/11 theo quy tắc cũ: trả đủ 299.000.
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

        // Vào ngày 17/11 còn 14/30 ngày gốc của Silver: 199.000 × 14/30 = 92.866 -> 92.000, cộng thêm vào 299.000.
        // Giá danh mục sau khi điều chỉnh (249.000 / 399.000) không ảnh hưởng.
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

    /** Kiểm thử P0-10: bảo lưu đã cộng bù vào endDate không làm thổi phồng trước bảo lưu hay hụt sau bảo lưu. */
    @Test
    void creditedHoldDaysAreExcludedFromPreHoldDuringHoldAndPostHoldProration() {
        // Gói 60 ngày: Day 1 (01/11) .. Day 60 (30/12), đã trả 6.000.000đ.
        MembershipPackage pkg = new MembershipPackage();
        pkg.setId(2L);
        pkg.setPrice(new BigDecimal("6000000"));
        pkg.setDurationDays(60);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(7L);
        sub.setMembershipPackage(pkg);
        sub.setStartDate(START); // Day 1
        // Bảo lưu 30 ngày: Day 30..Day 59 -> endDate được cộng thành Day 90 (START + 89).
        sub.setEndDate(START.plusDays(89));
        sub.setHoldStartDate(START.plusDays(29)); // Day 30
        sub.setHoldEndDate(START.plusDays(58));   // Day 59
        sub.setHoldStatus("APPROVED");
        sub.setHoldUsed(true);
        sub.setHoldDaysCredited(true);
        when(payments.findAllBySubscriptionId(7L)).thenReturn(List.of(payment("6000000", "success", null)));

        // Trước khi bảo lưu bắt đầu (Day 29 = START + 28): 32/60 = 3.200.000đ (không còn lỗi 62/90 = 4.133.000đ).
        assertThat(SubscriptionValueCalculator.totalDays(sub)).isEqualTo(60);
        assertThat(SubscriptionValueCalculator.remainingDays(sub, START.plusDays(28))).isEqualTo(32);
        assertThat(calculator.remainingValue(sub, START.plusDays(28))).isEqualByComparingTo("3200000");

        // Trong thời gian bảo lưu (Day 30, Day 40, Day 59): còn đúng 31 ngày dịch vụ (Day 60..90) = 3.100.000đ.
        sub.setStatus("frozen");
        assertThat(SubscriptionValueCalculator.remainingDays(sub, START.plusDays(29))).isEqualTo(31);
        assertThat(SubscriptionValueCalculator.remainingDays(sub, START.plusDays(39))).isEqualTo(31);
        assertThat(SubscriptionValueCalculator.remainingDays(sub, START.plusDays(58))).isEqualTo(31);
        assertThat(calculator.remainingValue(sub, START.plusDays(39))).isEqualByComparingTo("3100000");
        // Ngày sau khi bảo lưu kết thúc (Day 60): liên tục, vẫn là 31 ngày = 3.100.000đ.
        assertThat(SubscriptionValueCalculator.remainingDays(sub, START.plusDays(59))).isEqualTo(31);

        // Sau khi hoàn tất bảo lưu 30 ngày (Day 2..Day 31, endDate = Day 90): vào Day 32 còn 59/60 = 5.900.000đ.
        MembershipSubscription postHold = new MembershipSubscription();
        postHold.setId(7L);
        postHold.setMembershipPackage(pkg);
        postHold.setStartDate(START);              // Day 1
        postHold.setEndDate(START.plusDays(89));   // Day 90
        postHold.setHoldStartDate(START.plusDays(1));   // Day 2
        postHold.setHoldEndDate(START.plusDays(30));    // Day 31
        postHold.setStatus("active");
        postHold.setHoldStatus(null);
        postHold.setHoldUsed(true);
        postHold.setHoldDaysCredited(true);

        assertThat(SubscriptionValueCalculator.totalDays(postHold)).isEqualTo(60);
        assertThat(SubscriptionValueCalculator.remainingDays(postHold, START.plusDays(31))).isEqualTo(59);
        assertThat(calculator.remainingValue(postHold, START.plusDays(31))).isEqualByComparingTo("5900000");

        // Dữ liệu lịch sử đã tự mở lại trước khi giữ cờ holdDaysCredited (holdDaysCredited=null, holdUsed=true, holdStatus=null)
        postHold.setHoldDaysCredited(null);
        assertThat(SubscriptionValueCalculator.totalDays(postHold)).isEqualTo(60);
        assertThat(calculator.remainingValue(postHold, START.plusDays(31))).isEqualByComparingTo("5900000");

        // Bảo lưu quay lại đúng ngày đầu (0 ngày bảo lưu được cộng bù, holdDaysCredited=false): không trừ ngày nào.
        MembershipSubscription zeroHeld = new MembershipSubscription();
        zeroHeld.setId(7L);
        zeroHeld.setMembershipPackage(pkg);
        zeroHeld.setStartDate(START);
        zeroHeld.setEndDate(START.plusDays(59));
        zeroHeld.setHoldStartDate(START.plusDays(10));
        zeroHeld.setHoldEndDate(START.plusDays(19));
        zeroHeld.setHoldUsed(true);
        zeroHeld.setHoldStatus(null);
        zeroHeld.setHoldDaysCredited(false);
        assertThat(SubscriptionValueCalculator.totalDays(zeroHeld)).isEqualTo(60);
        assertThat(calculator.remainingValue(zeroHeld, START.plusDays(10))).isEqualByComparingTo("5000000");
    }
}
