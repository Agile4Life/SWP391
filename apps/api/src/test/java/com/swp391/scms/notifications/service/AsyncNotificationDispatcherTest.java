package com.swp391.scms.notifications.service;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AsyncNotificationDispatcherTest {

    @Mock
    private NotificationChannelAdapter inAppAdapter;

    @Mock
    private NotificationChannelAdapter emailAdapter;

    @Mock
    private NotificationChannelAdapter pushAdapter;

    @Mock
    private NotificationChannelAdapter webhookAdapter;

    private AsyncNotificationDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        lenient().when(inAppAdapter.getChannel()).thenReturn(NotificationChannel.IN_APP);
        lenient().when(emailAdapter.getChannel()).thenReturn(NotificationChannel.EMAIL);
        lenient().when(pushAdapter.getChannel()).thenReturn(NotificationChannel.PUSH);
        lenient().when(webhookAdapter.getChannel()).thenReturn(NotificationChannel.WEBHOOK);

        dispatcher = new AsyncNotificationDispatcher(List.of(
                inAppAdapter, emailAdapter, pushAdapter, webhookAdapter
        ));
    }

    @Test
    @DisplayName("Dispatch sends payload to all requested channels")
    void dispatch_SendsToMatchingChannels() {
        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Nhắc nhở")
                .message("Nội dung nhắc nhở")
                .type("class_reminder")
                .relatedEntityType("class_session")
                .relatedEntityId(201L)
                .channels(Set.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL))
                .build();

        dispatcher.dispatch(payload);

        verify(inAppAdapter).send(payload);
        verify(emailAdapter).send(payload);
        verify(pushAdapter, never()).send(any());
        verify(webhookAdapter, never()).send(any());
    }

    @Test
    @DisplayName("Dispatch handles adapter exceptions gracefully without failing other adapters")
    void dispatch_HandlesAdapterExceptionGracefully() {
        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Gói tập sắp hết hạn")
                .message("Gói tập hết hạn trong 7 ngày")
                .type("package_expiry")
                .channels(Set.of(NotificationChannel.EMAIL, NotificationChannel.PUSH))
                .build();

        doThrow(new RuntimeException("Email service down")).when(emailAdapter).send(payload);

        dispatcher.dispatch(payload);

        verify(emailAdapter).send(payload);
        verify(pushAdapter).send(payload); // Push still delivered successfully
    }

    @Test
    @DisplayName("Dispatch discards null payload safely")
    void dispatch_NullPayload_NoOp() {
        dispatcher.dispatch(null);

        verify(inAppAdapter, never()).send(any());
        verify(emailAdapter, never()).send(any());
    }

    @Test
    @DisplayName("Overloaded dispatch creates payload with default channels (IN_APP, EMAIL, PUSH)")
    void dispatch_Overload_DefaultChannels() {
        dispatcher.dispatch(101L, "Title", "Message", "system", "support_request", 501L);

        verify(inAppAdapter).send(argThat(p -> p.userId().equals(101L) && p.channels().contains(NotificationChannel.IN_APP)));
        verify(emailAdapter).send(argThat(p -> p.userId().equals(101L) && p.channels().contains(NotificationChannel.EMAIL)));
        verify(pushAdapter).send(argThat(p -> p.userId().equals(101L) && p.channels().contains(NotificationChannel.PUSH)));
        verify(webhookAdapter, never()).send(any());
    }
}

