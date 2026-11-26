package com.swp391.scms.membership;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.service.EntitlementRevocationService;
import com.swp391.scms.membership.service.MembershipLifecycleScheduler;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.annotation.Scheduled;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho MembershipLifecycleScheduler (timezone cron Việt Nam và dọn gói hết hạn). */
@ExtendWith(MockitoExtension.class)
class MembershipLifecycleSchedulerTest {

    @Mock private MembershipSubscriptionService subscriptions;
    @Mock private EntitlementRevocationService revocation;
    @Mock private MessageService messages;

    @Test
    void runDailyIsPinnedToVietnamTimezone() throws Exception {
        Method runDaily = MembershipLifecycleScheduler.class.getMethod("runDaily");
        Scheduled scheduled = runDaily.getAnnotation(Scheduled.class);
        assertThat(scheduled).isNotNull();
        assertThat(scheduled.zone()).isEqualTo("Asia/Ho_Chi_Minh");
    }

    @Test
    void runDailyExpiresPastDueSubscriptionsAndIsolatesPerItemErrors() {
        var scheduler = new MembershipLifecycleScheduler(subscriptions, revocation, messages);
        when(subscriptions.findActiveSubscriptionsPastDue()).thenReturn(List.of(10L, 11L, 12L));
        when(subscriptions.expireSubscription(10L)).thenReturn(true);
        when(subscriptions.expireSubscription(11L)).thenThrow(new RuntimeException("transient db error"));
        when(subscriptions.expireSubscription(12L)).thenReturn(true);
        when(subscriptions.findHoldsDueToStart()).thenReturn(List.of());
        when(subscriptions.findHoldsDueForResume()).thenReturn(List.of());
        when(subscriptions.findDatedHoldsDueForResume()).thenReturn(List.of());
        when(revocation.membersWithUpcomingBookings()).thenReturn(Set.of());

        scheduler.runDaily();

        verify(subscriptions).expireSubscription(10L);
        verify(subscriptions).expireSubscription(11L);
        verify(subscriptions).expireSubscription(12L);
        assertThat(scheduler.expirePastDueSubscriptions()).isEqualTo(2);
    }
}
