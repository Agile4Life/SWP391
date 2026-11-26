package com.swp391.scms.membership;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.EntitlementRevocationService;
import com.swp391.scms.scheduling.service.EnrollmentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service EntitlementRevocationService (entitlement revocation service). */
@ExtendWith(MockitoExtension.class)
class EntitlementRevocationServiceTest {

    @Mock private MembershipSubscriptionRepository subscriptions;
    @Mock private EnrollmentService enrollmentService;
    @Mock private CoachBookingRepository coachBookings;

    /** Kiểm thử: chỉ nhả các đặt chỗ ở những ngày không còn membership nào bao phủ. */
    @Test
    void releasesOnlyBookingsOnDatesNoActiveMembershipCovers() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, clock);
        LocalDate today = LocalDate.of(2026, 10, 11);
        LocalDate covered = LocalDate.of(2026, 10, 20);
        LocalDate gap = LocalDate.of(2026, 11, 5);
        CoachBooking keep = pt(covered);
        CoachBooking release = pt(gap);
        when(subscriptions.hasActiveMembership(10L, covered)).thenReturn(true);
        when(subscriptions.hasActiveMembership(10L, gap)).thenReturn(false);
        when(enrollmentService.cancelFutureEnrollmentsForMember(eq(10L), any(), any())).thenReturn(1);
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(keep, release));

        assertEquals(2, service.revokeUncoveredBookings(10L, "Hết hạn"));
        assertEquals("confirmed", keep.getStatus());
        assertEquals("cancelled", release.getStatus());
    }

    /**
     * Kiểm thử: membership đóng băng có tạm hoãn theo ngày vẫn bao phủ các ngày sau tạm hoãn nên lượt quét đêm
     * giữ các đặt chỗ đó.
     */
    @Test
    void aFrozenMembershipWithADatedHoldStillCoversTheDaysAfterTheHoldSoTheNightlySweepKeepsThoseBookings() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, clock);
        LocalDate today = LocalDate.of(2026, 10, 11);
        // Đóng băng 12-18 tháng 10 (tạm hoãn 7 ngày); kỳ hạn 01/10 - 30/11 thành 01/10 - 07/12 khi mở lại.
        var frozen = new com.swp391.scms.membership.entity.MembershipSubscription();
        frozen.setStatus("frozen");
        frozen.setHoldStatus("APPROVED");
        frozen.setStartDate(LocalDate.of(2026, 10, 1));
        frozen.setEndDate(LocalDate.of(2026, 11, 30));
        frozen.setHoldStartDate(LocalDate.of(2026, 10, 12));
        frozen.setHoldEndDate(LocalDate.of(2026, 10, 18));
        when(subscriptions.findByMemberUserIdAndStatus(10L, "frozen")).thenReturn(List.of(frozen));
        when(subscriptions.hasActiveMembership(eq(10L), any())).thenReturn(false);
        CoachBooking afterHold = pt(LocalDate.of(2026, 10, 25));
        CoachBooking lastExtendedDay = pt(LocalDate.of(2026, 12, 7));
        CoachBooking pastTheEnd = pt(LocalDate.of(2026, 12, 8));
        when(enrollmentService.cancelFutureEnrollmentsForMember(eq(10L), any(), any())).thenAnswer(inv -> {
            java.util.function.Predicate<LocalDate> covered = inv.getArgument(2);
            // Ngày nằm ngay trong khoảng bảo lưu [12..18] KHÔNG được bao phủ; ngày sau bảo lưu tới hạn mở rộng được giữ.
            assertFalse(covered.test(LocalDate.of(2026, 10, 14)));
            assertTrue(covered.test(LocalDate.of(2026, 10, 25)));
            assertFalse(covered.test(LocalDate.of(2026, 12, 8)));
            return 0;
        });
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(afterHold, lastExtendedDay, pastTheEnd));

        assertEquals(1, service.revokeUncoveredBookings(10L, "Sweep"));

        assertEquals("confirmed", afterHold.getStatus());
        assertEquals("confirmed", lastExtendedDay.getStatus());
        assertEquals("cancelled", pastTheEnd.getStatus());
    }

    /** Hàm trợ giúp của test: tạo dịch vụ tạm hoãn với phụ thuộc giả lập. */
    private EntitlementRevocationService holdService(com.swp391.scms.finance.repository.PaymentRepository payments,
                                                     com.swp391.scms.wallet.WalletService wallets) {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, clock);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "payments", payments);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "walletService", wallets);
        return service;
    }

    /** Hàm trợ giúp của test: tạo khoản thanh toán thành công mẫu. */
    private static com.swp391.scms.finance.entity.Payment successPayment(String amount) {
        var payment = new com.swp391.scms.finance.entity.Payment();
        payment.setAmount(new java.math.BigDecimal(amount));
        payment.setStatus("success");
        return payment;
    }

    /** Kiểm thử: tạm hoãn chỉ hoàn lượt PT khi được duyệt trước 3 ngày. */
    @Test
    void holdReturnsAPtQuotaSlotOnlyWhenApprovedThreeDaysAhead() {
        var service = holdService(null, null);
        LocalDate today = LocalDate.of(2026, 10, 11);
        CoachBooking inTime = pt(today.plusDays(3));
        CoachBooking late = pt(today.plusDays(2));
        inTime.setPaymentMethod("package_quota");
        late.setPaymentMethod("package_quota");
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(inTime, late));

        assertEquals(2, service.releaseBookingsBetween(10L, today, today.plusDays(30), "hold"));

        assertEquals("cancelled", inTime.getStatus());
        assertFalse(inTime.isQuotaForfeited());
        assertEquals("cancelled", late.getStatus());
        assertTrue(late.isQuotaForfeited());
    }

    /** Kiểm thử: tạm hoãn chỉ hoàn tiền buổi PT đã trả vào ví khi được duyệt trước 3 ngày. */
    @Test
    void holdRefundsAPaidPtSessionToTheWalletOnlyWhenApprovedThreeDaysAhead() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var wallets = org.mockito.Mockito.mock(com.swp391.scms.wallet.WalletService.class);
        var service = holdService(payments, wallets);
        LocalDate today = LocalDate.of(2026, 10, 11);
        CoachBooking inTime = pt(today.plusDays(5));
        CoachBooking late = pt(today.plusDays(1));
        inTime.setId(1L);
        late.setId(2L);
        var member = new com.swp391.scms.users.entity.Member();
        member.setUserId(10L);
        inTime.setMember(member);
        late.setMember(member);
        inTime.setPaymentMethod("cash");
        late.setPaymentMethod("cash");
        var paidInTime = successPayment("200000");
        var paidLate = successPayment("200000");
        when(payments.findAllByCoachBookingId(1L)).thenReturn(List.of(paidInTime));
        when(payments.findAllByCoachBookingId(2L)).thenReturn(List.of(paidLate));
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(inTime, late));

        service.releaseBookingsBetween(10L, today, today.plusDays(30), "hold");

        assertEquals("refunded", paidInTime.getStatus());
        assertEquals("success", paidLate.getStatus());
        org.mockito.Mockito.verify(wallets).creditCoachBookingRefund(eq(10L), eq(new java.math.BigDecimal("200000")), eq("COACH_REFUND_1"), any());
        org.mockito.Mockito.verifyNoMoreInteractions(wallets);
    }

    /** Kiểm thử P2-BE-35: gói frozen đã cộng bù ngày bảo lưu (holdDaysCredited=true) không bị cộng thêm lần 2. */
    @Test
    void creditedFrozenHoldDoesNotDoubleAddHeldDaysAndExcludesHoldDates() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, clock);
        LocalDate today = LocalDate.of(2026, 10, 11);
        var frozen = new com.swp391.scms.membership.entity.MembershipSubscription();
        frozen.setStatus("frozen");
        frozen.setHoldStatus("APPROVED");
        frozen.setHoldDaysCredited(true);
        frozen.setStartDate(LocalDate.of(2026, 10, 1));
        frozen.setEndDate(LocalDate.of(2026, 12, 7)); // Đã cộng sẵn 7 ngày (30/11 + 7 = 07/12)
        frozen.setHoldStartDate(LocalDate.of(2026, 10, 12));
        frozen.setHoldEndDate(LocalDate.of(2026, 10, 18));
        when(subscriptions.findByMemberUserIdAndStatus(10L, "frozen")).thenReturn(List.of(frozen));
        when(subscriptions.hasActiveMembership(eq(10L), any())).thenReturn(false);

        CoachBooking duringHold = pt(LocalDate.of(2026, 10, 15));
        CoachBooking lastDay = pt(LocalDate.of(2026, 12, 7));
        CoachBooking doubleAddedDay = pt(LocalDate.of(2026, 12, 10)); // Nếu cộng lặp 7 ngày sẽ bị giữ nhầm!
        when(enrollmentService.cancelFutureEnrollmentsForMember(eq(10L), any(), any())).thenReturn(0);
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(duringHold, lastDay, doubleAddedDay));

        assertEquals(2, service.revokeUncoveredBookings(10L, "Sweep"));
        assertEquals("cancelled", duringHold.getStatus());
        assertEquals("confirmed", lastDay.getStatus());
        assertEquals("cancelled", doubleAddedDay.getStatus());
    }

    /** Kiểm thử P1-BE-30: revokeUncoveredBookings hoàn tiền buổi PT đã trả về ví và đóng khoản thu pending. */
    @Test
    void revokeUncoveredBookingsRefundsPaidPtToWalletAndFailsPendingPtPayment() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var wallets = org.mockito.Mockito.mock(com.swp391.scms.wallet.WalletService.class);
        var service = holdService(payments, wallets);
        LocalDate today = LocalDate.of(2026, 10, 11);
        var member = new com.swp391.scms.users.entity.Member();
        member.setUserId(10L);

        CoachBooking paidPt = pt(today.plusDays(5));
        paidPt.setId(501L);
        paidPt.setMember(member);
        var successPay = successPayment("200000");

        CoachBooking pendingPt = pt(today.plusDays(6));
        pendingPt.setId(502L);
        pendingPt.setMember(member);
        var pendingPay = new com.swp391.scms.finance.entity.Payment();
        pendingPay.setAmount(new java.math.BigDecimal("200000"));
        pendingPay.setStatus("pending");

        when(subscriptions.hasActiveMembership(eq(10L), any())).thenReturn(false);
        when(subscriptions.findByMemberUserIdAndStatus(10L, "frozen")).thenReturn(List.of());
        when(enrollmentService.cancelFutureEnrollmentsForMember(eq(10L), any(), any())).thenReturn(0);
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(paidPt, pendingPt));
        when(payments.findAllByCoachBookingId(501L)).thenReturn(List.of(successPay));
        when(payments.findAllByCoachBookingId(502L)).thenReturn(List.of(pendingPay));

        assertEquals(2, service.revokeUncoveredBookings(10L, "Hủy gói"));
        assertEquals("cancelled", paidPt.getStatus());
        assertEquals("refunded", successPay.getStatus());
        assertEquals(0, new java.math.BigDecimal("200000").compareTo(successPay.getRefundedAmount()));
        assertEquals("cancelled", pendingPt.getStatus());
        assertEquals("failed", pendingPay.getStatus());
        org.mockito.Mockito.verify(wallets).creditCoachBookingRefund(
                eq(10L), eq(new java.math.BigDecimal("200000")), eq("COACH_REFUND_501"), eq("Hủy gói"));
        org.mockito.Mockito.verifyNoMoreInteractions(wallets);
    }

    /** Hàm trợ giúp của test: tạo lượt đặt PT mẫu. */
    private static CoachBooking pt(LocalDate date) {
        CoachBooking booking = new CoachBooking();
        booking.setBookingDate(date);
        booking.setStartTime(LocalTime.of(9, 0));
        booking.setEndTime(LocalTime.of(10, 0));
        booking.setStatus("confirmed");
        return booking;
    }
}
