package com.swp391.scms.membership;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.courts.entity.CourtBooking;
import com.swp391.scms.courts.repository.CourtBookingRepository;
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
    @Mock private CourtBookingRepository courtBookings;

    /** Kiểm thử: chỉ nhả các đặt chỗ ở những ngày không còn membership nào bao phủ. */
    @Test
    void releasesOnlyBookingsOnDatesNoActiveMembershipCovers() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, courtBookings, clock);
        LocalDate today = LocalDate.of(2026, 10, 11);
        LocalDate covered = LocalDate.of(2026, 10, 20);
        LocalDate gap = LocalDate.of(2026, 11, 5);
        CoachBooking keep = pt(covered);
        CoachBooking release = pt(gap);
        CourtBooking court = new CourtBooking();
        court.setBookingDate(gap);
        court.setStartTime(LocalTime.of(14, 0));
        when(subscriptions.hasActiveMembership(10L, covered)).thenReturn(true);
        when(subscriptions.hasActiveMembership(10L, gap)).thenReturn(false);
        when(enrollmentService.cancelFutureEnrollmentsForMember(eq(10L), any(), any())).thenReturn(1);
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(keep, release));
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of(court));

        assertEquals(3, service.revokeUncoveredBookings(10L, "Hết hạn"));
        assertEquals("confirmed", keep.getStatus());
        assertEquals("cancelled", release.getStatus());
        assertEquals("cancelled", court.getStatus());
    }

    /**
     * Kiểm thử: membership đóng băng có tạm hoãn theo ngày vẫn bao phủ các ngày sau tạm hoãn nên lượt quét đêm
     * giữ các đặt chỗ đó.
     */
    @Test
    void aFrozenMembershipWithADatedHoldStillCoversTheDaysAfterTheHoldSoTheNightlySweepKeepsThoseBookings() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, courtBookings, clock);
        LocalDate today = LocalDate.of(2026, 10, 11);
        // Frozen 12-18 October (7 days held); the period 1 Oct - 30 Nov becomes 1 Oct - 7 Dec once it resumes.
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
            // A course seat whose next session falls in the hold or right after it is kept.
            assertTrue(covered.test(LocalDate.of(2026, 10, 14)));
            assertTrue(covered.test(LocalDate.of(2026, 10, 25)));
            assertFalse(covered.test(LocalDate.of(2026, 12, 8)));
            return 0;
        });
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of(afterHold, lastExtendedDay, pastTheEnd));
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of());

        assertEquals(1, service.revokeUncoveredBookings(10L, "Sweep"));

        assertEquals("confirmed", afterHold.getStatus());
        assertEquals("confirmed", lastExtendedDay.getStatus());
        assertEquals("cancelled", pastTheEnd.getStatus());
    }

    /** Hàm trợ giúp của test: tạo dịch vụ tạm hoãn với phụ thuộc giả lập. */
    private EntitlementRevocationService holdService(com.swp391.scms.finance.repository.PaymentRepository payments,
                                                     com.swp391.scms.wallet.WalletService wallets) {
        Clock clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        var service = new EntitlementRevocationService(subscriptions, enrollmentService, coachBookings, courtBookings, clock);
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

    /** Hàm trợ giúp của test: tạo đặt sân mẫu. */
    private static CourtBooking court(LocalDate date, LocalTime start, String method, String paymentStatus) {
        CourtBooking court = new CourtBooking();
        court.setBookingDate(date);
        court.setStartTime(start);
        court.setPaymentMethod(method);
        court.setPaymentStatus(paymentStatus);
        court.setStatus("booked");
        var user = new com.swp391.scms.users.entity.User();
        user.setId(10L);
        court.setMember(user);
        return court;
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
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of());

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
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of());

        service.releaseBookingsBetween(10L, today, today.plusDays(30), "hold");

        assertEquals("refunded", paidInTime.getStatus());
        assertEquals("success", paidLate.getStatus());
        org.mockito.Mockito.verify(wallets).creditCoachBookingRefund(eq(10L), eq(new java.math.BigDecimal("200000")), eq("COACH_REFUND_1"), any());
        org.mockito.Mockito.verifyNoMoreInteractions(wallets);
    }

    /** Kiểm thử: tạm hoãn chỉ hoàn tiền sân đã trả khi được duyệt trước 2 giờ. */
    @Test
    void holdRefundsAPaidCourtOnlyWhenApprovedTwoHoursAhead() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var wallets = org.mockito.Mockito.mock(com.swp391.scms.wallet.WalletService.class);
        var service = holdService(payments, wallets);
        LocalDate today = LocalDate.of(2026, 10, 11);
        // The clock is 10:00 UTC; 12:00 is exactly two hours ahead, 11:00 is one hour ahead.
        CourtBooking inTime = court(today, LocalTime.of(12, 0), "vnpay", "paid");
        CourtBooking late = court(today, LocalTime.of(11, 0), "vnpay", "paid");
        inTime.setId(1L);
        late.setId(2L);
        var paidInTime = successPayment("100000");
        var paidLate = successPayment("100000");
        when(payments.findAllByCourtBookingId(1L)).thenReturn(List.of(paidInTime));
        when(payments.findAllByCourtBookingId(2L)).thenReturn(List.of(paidLate));
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of());
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of(inTime, late));

        service.releaseBookingsBetween(10L, today, today.plusDays(30), "hold");

        assertEquals("refunded", paidInTime.getStatus());
        assertEquals("success", paidLate.getStatus());
        org.mockito.Mockito.verify(wallets).creditCourtRefund(eq(10L), eq(new java.math.BigDecimal("100000")), eq("COURT_REFUND_1"), any());
        org.mockito.Mockito.verifyNoMoreInteractions(wallets);
    }

    /** Kiểm thử: tạm hoãn trong vòng 2 giờ thì mất lượt đặt sân. */
    @Test
    void holdForfeitsACourtQuotaSlotWithinTwoHours() {
        var service = holdService(null, null);
        LocalDate today = LocalDate.of(2026, 10, 11);
        CourtBooking inTime = court(today, LocalTime.of(12, 0), "package_quota", "covered");
        CourtBooking late = court(today, LocalTime.of(11, 59), "package_quota", "covered");
        when(coachBookings.findFutureConfirmedByMember(10L, today)).thenReturn(List.of());
        when(courtBookings.findUpcomingBookedByMember(10L, today)).thenReturn(List.of(inTime, late));

        service.releaseBookingsBetween(10L, today, today.plusDays(30), "hold");

        assertFalse(inTime.isQuotaForfeited());
        assertTrue(late.isQuotaForfeited());
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
