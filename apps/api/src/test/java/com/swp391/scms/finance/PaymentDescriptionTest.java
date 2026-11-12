package com.swp391.scms.finance;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.scms.courts.entity.CourtBooking;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.membership.entity.MembershipSubscription;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** A member's payment list says what each payment is for (reported: pending payments only showed an id and amount). */
class PaymentDescriptionTest {

    private static PaymentDto describe(Payment payment) throws Exception {
        Method method = com.swp391.scms.finance.service.PaymentService.class
                .getDeclaredMethod("describe", Payment.class, PaymentDto.class);
        method.setAccessible(true);
        return (PaymentDto) method.invoke(null, payment, new PaymentDto());
    }

    @Test
    void courtPaymentNamesTheCourtAndSlot() throws Exception {
        Room room = new Room();
        room.setName("Sân Tennis 01");
        CourtBooking booking = new CourtBooking();
        booking.setRoom(room);
        booking.setBookingDate(LocalDate.of(2026, 11, 20));
        booking.setStartTime(LocalTime.of(14, 0));
        Payment payment = new Payment();
        payment.setCourtBookingId(37L);
        ReflectionTestUtils.setField(payment, "courtBooking", booking);

        PaymentDto dto = describe(payment);

        assertThat(dto.getServiceType()).isEqualTo("COURT");
        assertThat(dto.getServiceName()).isEqualTo("Sân Tennis 01 · 20/11/2026 · 14:00");
    }

    @Test
    void membershipPaymentNamesThePackage() throws Exception {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("GOLD");
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        Payment payment = new Payment();
        payment.setSubscriptionId(5L);
        ReflectionTestUtils.setField(payment, "subscription", sub);

        PaymentDto dto = describe(payment);

        assertThat(dto.getServiceType()).isEqualTo("MEMBERSHIP");
        assertThat(dto.getServiceName()).isEqualTo("GOLD");
    }

    @Test
    void walletTopupPaymentIsLabelledAsAWalletTopup() throws Exception {
        Payment payment = new Payment();
        payment.setNote("WALLET_TOPUP:COUNTER");

        PaymentDto dto = describe(payment);

        assertThat(dto.getServiceType()).isEqualTo("WALLET_TOPUP");
    }

    @Test
    void unlinkedPaymentIsOther() throws Exception {
        PaymentDto dto = describe(new Payment());
        assertThat(dto.getServiceType()).isEqualTo("OTHER");
        assertThat(dto.getServiceName()).isNull();
    }
}
