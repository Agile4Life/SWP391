package com.swp391.scms.membership;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MembershipRequestHistoryService;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
class ReceptionHistoryWindowTest {
    @Test void allTimeDoesNotUseTheOld180DayLimit() {
        var payments = mock(PaymentRepository.class); var subscriptions = mock(MembershipSubscriptionRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-11-25T10:00:00Z"), ZoneOffset.ofHours(7));
        new MembershipRequestHistoryService(payments, subscriptions, clock).history(0);
        verify(payments).findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(List.of("success", "refunded"));
        verify(subscriptions).findByStatusOrderByUpdatedAtDesc("cancelled");
        verifyNoMoreInteractions(payments, subscriptions);
    }
    @Test void todayStartsAtMidnight() {
        var payments = mock(PaymentRepository.class); var subscriptions = mock(MembershipSubscriptionRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-11-25T10:00:00Z"), ZoneOffset.ofHours(7));
        new MembershipRequestHistoryService(payments, subscriptions, clock).history(1);
        verify(payments).findBySubscriptionIdIsNotNullAndStatusInAndPaidAtGreaterThanEqualOrderByPaidAtDesc(anyList(), eq(LocalDateTime.of(2026,11,25,0,0)));
    }
}
