package com.swp391.scms.wallet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** Bộ kiểm thử cho service CounterTopupService (counter topup service). */
class CounterTopupServiceTest {
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final InvoiceService invoices = mock(InvoiceService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-12T15:50:00Z"), ZoneOffset.UTC);
    private final CounterTopupService service = new CounterTopupService(payments, members, users, invoices, clock);

    /** Kiểm thử: phương thức không biết được ghi nhận là tiền mặt. */
    @Test void allTimeIncludesHistoricalNonCashMethods() {
        User user = new User(); user.setFullName("Member"); Member member = new Member(); member.setUser(user);
        Payment payment = new Payment(); payment.setId(1L); payment.setMember(member); payment.setMethod("pos");
        when(payments.findByNoteAndStatusOrderByPaidAtDesc(any(), any())).thenReturn(java.util.List.of(payment));
        assertThat(service.history(0)).hasSize(1);
        assertThat(service.history(0).get(0).paymentMethod()).isEqualTo("pos");
    }

    @Test
    void unknownMethodsAreRecordedAsCash() {
        assertThat(CounterTopupService.normalizeMethod(null)).isEqualTo("cash");
        assertThat(CounterTopupService.normalizeMethod("Bank_Transfer")).isEqualTo("bank_transfer");
        assertThat(CounterTopupService.normalizeMethod("POS")).isEqualTo("pos");
        assertThat(CounterTopupService.normalizeMethod("crypto")).isEqualTo("cash");
    }

    /** Kiểm thử: ghi nhận khoản nạp ví đã thanh toán và phát hành hóa đơn. */
    @Test
    void recordsASettledWalletTopupPaymentAndIssuesItsInvoice() {
        Member member = new Member();
        User staff = new User();
        when(members.findById(7L)).thenReturn(Optional.of(member));
        when(users.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(staff));
        when(payments.save(any(Payment.class))).thenAnswer(call -> {
            Payment saved = call.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        service.record(7L, new BigDecimal("1000000"), "pos", 3L);

        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(payments).save(saved.capture());
        Payment payment = saved.getValue();
        assertThat(payment.getStatus()).isEqualTo("success");
        assertThat(payment.getMethod()).isEqualTo("pos");
        assertThat(payment.getNote()).isEqualTo(CounterTopupService.COUNTER_NOTE);
        assertThat(payment.getReceivedBy()).isSameAs(staff);
        assertThat(payment.getPaidAt()).isNotNull();
        verify(invoices).autoIssueInvoiceForPayment(99L);
    }

    /** Kiểm thử: hóa đơn lỗi không làm hoàn tác việc nạp ví. */
    @Test
    void aFailingInvoiceDoesNotUndoTheTopup() {
        when(members.findById(7L)).thenReturn(Optional.of(new Member()));
        when(payments.save(any(Payment.class))).thenAnswer(call -> {
            Payment saved = call.getArgument(0);
            saved.setId(100L);
            return saved;
        });
        when(invoices.autoIssueInvoiceForPayment(100L)).thenThrow(new IllegalStateException("invoice store down"));

        service.record(7L, new BigDecimal("500000"), "cash", null);

        verify(payments).save(any(Payment.class));
        verify(invoices).autoIssueInvoiceForPayment(100L);
    }
}
