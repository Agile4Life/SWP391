package com.swp391.scms.membership;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.support.ResourceBundleMessageSource;
import java.time.Clock;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PendingCancellationReasonTest {
    private final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final AuthenticatedPrincipal desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
    private MembershipSubscriptionService service;
    private MembershipSubscription subscription;

    @BeforeEach void setup() {
        var messages = new ResourceBundleMessageSource();
        messages.setBasename("i18n/messages"); messages.setDefaultEncoding("UTF-8");
        service = new MembershipSubscriptionService(subscriptions, mock(MembershipPackageRepository.class), members,
                Clock.systemUTC(), null, null, null, notifications, new MessageService(messages));
        var member = new Member(); member.setUserId(10L);
        var pack = new MembershipPackage(); pack.setId(3L); pack.setName("Gold");
        subscription = new MembershipSubscription(); subscription.setId(50L); subscription.setMember(member);
        subscription.setMembershipPackage(pack); subscription.setStatus("pending_payment");
        when(subscriptions.findById(50L)).thenReturn(Optional.of(subscription));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(subscriptions.findByIdForUpdate(50L)).thenReturn(Optional.of(subscription));
        when(subscriptions.saveAndFlush(subscription)).thenReturn(subscription);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"   ", "\t\n", "\u00a0"})
    void receptionistMustProvideReason(String reason) {
        assertThatThrownBy(() -> service.cancelPending(desk, 50L, reason)).isInstanceOf(BadRequestException.class);
        assertThat(subscription.getStatus()).isEqualTo("pending_payment");
        verify(subscriptions, never()).saveAndFlush(any()); verifyNoInteractions(notifications);
    }

    @Test void trimsPersistsAndNotifiesTheOwnerOnce() {
        service.cancelPending(desk, 50L, "  Wrong package  ");
        assertThat(subscription.getPendingCancellationReason()).isEqualTo("Wrong package");
        assertThat(subscription.getStatus()).isEqualTo("cancelled");
        verify(subscriptions).saveAndFlush(subscription);
        verify(notifications).send(eq(10L), anyString(), contains("Wrong package"), eq("system"),
                eq("membership_subscription"), eq(50L), eq("/member/packages"));
        service.cancelPending(desk, 50L, "Another reason");
        assertThat(subscription.getPendingCancellationReason()).isEqualTo("Wrong package");
        verifyNoMoreInteractions(notifications);
    }

    @Test void rejectsLongReasonBeforeWriting() {
        assertThatThrownBy(() -> service.cancelPending(desk, 50L, "x".repeat(501))).isInstanceOf(BadRequestException.class);
        verify(subscriptions, never()).saveAndFlush(any()); verifyNoInteractions(notifications);
    }

    @Test void failedSaveDoesNotSendSuccessNotification() {
        when(subscriptions.saveAndFlush(subscription)).thenThrow(new IllegalStateException("DB unavailable"));
        assertThatThrownBy(() -> service.cancelPending(desk, 50L, "Wrong package")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(notifications);
    }

    @Test void unrelatedMemberCannotCancel() {
        assertThatThrownBy(() -> service.cancelPending(new AuthenticatedPrincipal(20L, "other", "MEMBER"), 50L, "Wrong package"))
                .isInstanceOf(ForbiddenException.class);
        verify(subscriptions, never()).saveAndFlush(any()); verifyNoInteractions(notifications);
    }

    @Test void ownerCanStillWithdrawWithoutReason() {
        service.cancelPending(new AuthenticatedPrincipal(10L, "owner", "MEMBER"), 50L);
        assertThat(subscription.getStatus()).isEqualTo("cancelled");
        assertThat(subscription.getPendingCancellationReason()).isNull();
        verifyNoInteractions(notifications);
    }
}
