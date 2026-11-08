package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.NotificationRepository;
import com.swp391.scms.notifications.entity.Notification;
import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationPayload;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationChannelAdaptersTest {

    @Test
    void simulatedChannelsDoNotLogAddressesOrNotificationContents() {
        Logger emailLogger = (Logger) LoggerFactory.getLogger(MockEmailNotificationChannelAdapter.class);
        Logger pushLogger = (Logger) LoggerFactory.getLogger(MockPushNotificationChannelAdapter.class);
        Logger webhookLogger = (Logger) LoggerFactory.getLogger(MockWebhookNotificationChannelAdapter.class);
        ListAppender<ILoggingEvent> emailLogs = new ListAppender<>();
        ListAppender<ILoggingEvent> pushLogs = new ListAppender<>();
        ListAppender<ILoggingEvent> webhookLogs = new ListAppender<>();
        emailLogs.start();
        pushLogs.start();
        webhookLogs.start();
        emailLogger.addAppender(emailLogs);
        pushLogger.addAppender(pushLogs);
        webhookLogger.addAppender(webhookLogs);
        try {
            NotificationPayload payload = NotificationPayload.builder().userId(101L)
                    .recipientEmail("private@example.com").title("private-title")
                    .message("private-health-note").type("support_reply").build();
            new MockEmailNotificationChannelAdapter(userRepository).send(payload);
            new MockPushNotificationChannelAdapter().send(payload);
            new MockWebhookNotificationChannelAdapter().send(payload);
            for (ListAppender<ILoggingEvent> logs : java.util.List.of(emailLogs, pushLogs, webhookLogs)) {
                assertThat(logs.list).isNotEmpty();
                String output = logs.list.stream().map(ILoggingEvent::getFormattedMessage)
                        .collect(java.util.stream.Collectors.joining("\n"));
                assertThat(output).doesNotContain("private@example.com", "private-title", "private-health-note");
            }
        } finally {
            emailLogger.detachAppender(emailLogs);
            pushLogger.detachAppender(pushLogs);
            webhookLogger.detachAppender(webhookLogs);
            emailLogs.stop();
            pushLogs.stop();
            webhookLogs.stop();
        }
    }

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    @DisplayName("InAppAdapter: saves notification for active user")
    void inAppAdapter_Success() {
        InAppNotificationChannelAdapter adapter = new InAppNotificationChannelAdapter(notificationRepository, userRepository);
        assertThat(adapter.getChannel()).isEqualTo(NotificationChannel.IN_APP);

        User user = new User();
        user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Gói tập sắp hết hạn")
                .message("Còn 7 ngày")
                .type("package_expiry")
                .relatedEntityType("membership_subscription")
                .relatedEntityId(201L)
                .build();

        adapter.send(payload);

        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    @DisplayName("InAppAdapter: skips when user not found or deleted")
    void inAppAdapter_UserNotFound_Skips() {
        InAppNotificationChannelAdapter adapter = new InAppNotificationChannelAdapter(notificationRepository, userRepository);

        when(userRepository.findByIdAndDeletedAtIsNull(999L)).thenReturn(Optional.empty());

        NotificationPayload payload = NotificationPayload.builder()
                .userId(999L)
                .title("Test")
                .message("Test")
                .type("system")
                .build();

        adapter.send(payload);

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("MockEmailAdapter: logs email simulation with user email lookup")
    void mockEmailAdapter_Success() {
        MockEmailNotificationChannelAdapter adapter = new MockEmailNotificationChannelAdapter(userRepository);
        assertThat(adapter.getChannel()).isEqualTo(NotificationChannel.EMAIL);

        User user = new User();
        user.setId(101L);
        user.setEmail("member@example.com");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Lịch học sắp tới")
                .message("Yoga lúc 10h")
                .type("class_reminder")
                .build();

        adapter.send(payload);

        verify(userRepository).findByIdAndDeletedAtIsNull(101L);
    }

    @Test
    @DisplayName("MockPushAdapter: logs push simulation")
    void mockPushAdapter_Success() {
        MockPushNotificationChannelAdapter adapter = new MockPushNotificationChannelAdapter();
        assertThat(adapter.getChannel()).isEqualTo(NotificationChannel.PUSH);

        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Đổi lịch tập")
                .message("Lớp chuyển sang 15h")
                .type("schedule_change")
                .timestamp(LocalDateTime.now())
                .build();

        adapter.send(payload);
        // Logging executed safely without throwing
    }

    @Test
    @DisplayName("MockWebhookAdapter: logs webhook simulation")
    void mockWebhookAdapter_Success() {
        MockWebhookNotificationChannelAdapter adapter = new MockWebhookNotificationChannelAdapter();
        assertThat(adapter.getChannel()).isEqualTo(NotificationChannel.WEBHOOK);

        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Xác nhận thanh toán")
                .message("Đã nhận 500,000 VND")
                .type("payment")
                .timestamp(LocalDateTime.now())
                .build();

        adapter.send(payload);
        // Webhook executed safely without throwing
    }

    @Test
    @DisplayName("EmailAdapter: dispatches wallet credit notification via Resend HTTP API when apiKey is configured")
    void emailAdapter_ResendWalletCredit_Success() {
        org.springframework.web.client.RestClient.Builder builder =
                org.springframework.web.client.RestClient.builder().baseUrl("https://api.resend.com");
        org.springframework.test.web.client.MockRestServiceServer server =
                org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();

        User user = new User();
        user.setId(101L);
        user.setFullName("Nguyễn Văn A");
        user.setEmail("member@example.com");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("https://api.resend.com/emails"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.method(org.springframework.http.HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header(
                        org.springframework.http.HttpHeaders.AUTHORIZATION, "Bearer re_live_key"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.to[0]").value("member@example.com"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.subject").value("Nạp tiền vào Ví SÖL thành công"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.text")
                        .value("Ví của bạn đã được cộng +500000 VNĐ qua phương thức: VNPay (#VNP999). Số dư mới: 500000 VNĐ."))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.html")
                        .value(org.hamcrest.Matchers.containsString("Nguyễn Văn A")))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.html")
                        .value(org.hamcrest.Matchers.containsString("VÍ ĐIỆN TỬ SÖL")))
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess(
                        "{\"id\":\"email_wallet_1\"}", org.springframework.http.MediaType.APPLICATION_JSON));

        MockEmailNotificationChannelAdapter adapter = new MockEmailNotificationChannelAdapter(
                userRepository, "re_live_key", "SÖL Fitness <onboarding@resend.dev>", builder.build());

        NotificationPayload payload = NotificationPayload.builder()
                .userId(101L)
                .title("Nạp tiền vào Ví SÖL thành công")
                .message("Ví của bạn đã được cộng +500000 VNĐ qua phương thức: VNPay (#VNP999). Số dư mới: 500000 VNĐ.")
                .type("payment")
                .relatedEntityType("wallet")
                .relatedEntityId(10L)
                .build();

        adapter.send(payload);

        server.verify();
    }
}

