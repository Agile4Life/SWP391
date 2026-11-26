package com.swp391.scms.notifications;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.notifications.dto.NotificationDto;
import com.swp391.scms.notifications.entity.Notification;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service NotificationService (notification service). */
@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    /** Kiểm thử: gửi thông báo giữ nguyên nội dung gốc cho lưu trữ và gửi payload đã chuẩn hóa ra kênh ngoài. */
    @Test
    void sendPreservesOriginalContentForPersistenceAndExternalDelivery() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(new User()));

        service.send(101L, "Class session booked",
                "You booked class Sunrise Yoga on 2026-11-14 (07:00-08:30).", "booking", null, null);

        var saved = org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        assertThat(saved.getValue().getTitle()).isEqualTo("Class session booked");
        assertThat(saved.getValue().getMessage()).isEqualTo("You booked class Sunrise Yoga on 2026-11-14 (07:00-08:30).");

        var dispatched = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.notifications.port.NotificationPayload.class);
        verify(dispatcher).dispatch(dispatched.capture());
        assertThat(dispatched.getValue().userId()).isEqualTo(101L);
        assertThat(dispatched.getValue().title()).isEqualTo("Class session booked");
        assertThat(dispatched.getValue().message()).isEqualTo("You booked class Sunrise Yoga on 2026-11-14 (07:00-08:30).");
        assertThat(dispatched.getValue().type()).isEqualTo("class_reminder");
        assertThat(dispatched.getValue().channels())
                .containsExactlyInAnyOrder(com.swp391.scms.notifications.port.NotificationChannel.PUSH);
    }

    /** Kiểm thử: các loại quan trọng còn được gửi qua email (gồm order/wallet đã chuẩn hóa về payment). */
    @Test
    void importantTypesAlsoGoByEmail() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(new User()));
        var emailAndPush = java.util.Set.of(com.swp391.scms.notifications.port.NotificationChannel.EMAIL,
                com.swp391.scms.notifications.port.NotificationChannel.PUSH);

        service.send(101L, "T", "M", "payment", "wallet", 1L);
        service.send(101L, "T", "M", "password_changed", "user", 1L);
        service.send(101L, "T", "M", "schedule_change", "class_session", 1L);
        service.send(101L, "T", "M", "package_expiry", "membership_subscription", 1L);
        service.send(101L, "T", "M", "order", "product_order", 2L, "/member/invoices");

        var captor = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.notifications.port.NotificationPayload.class);
        verify(dispatcher, times(5)).dispatch(captor.capture());
        var payloads = captor.getAllValues();

        assertThat(payloads.get(0).type()).isEqualTo("payment");
        assertThat(payloads.get(0).relatedEntityType()).isEqualTo("payment");
        assertThat(payloads.get(0).channels()).isEqualTo(emailAndPush);

        assertThat(payloads.get(1).type()).isEqualTo("password_changed");
        assertThat(payloads.get(1).relatedEntityType()).isNull();
        assertThat(payloads.get(1).channels()).isEqualTo(emailAndPush);

        assertThat(payloads.get(2).type()).isEqualTo("schedule_change");
        assertThat(payloads.get(2).relatedEntityType()).isEqualTo("class_session");
        assertThat(payloads.get(2).channels()).isEqualTo(emailAndPush);

        assertThat(payloads.get(3).type()).isEqualTo("package_expiry");
        assertThat(payloads.get(3).relatedEntityType()).isEqualTo("membership_subscription");
        assertThat(payloads.get(3).channels()).isEqualTo(emailAndPush);

        assertThat(payloads.get(4).type()).isEqualTo("payment");
        assertThat(payloads.get(4).actionPath()).isEqualTo("/member/invoices");
        assertThat(payloads.get(4).channels()).isEqualTo(emailAndPush);
    }

    /** Kiểm thử: gửi đa kênh giữ nguyên nội dung gốc. */
    @Test
    void multiChannelDispatchPreservesOriginalContent() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);

        service.dispatchMultiChannel(101L, "Upcoming class reminder",
                "Your class \"Sunrise Yoga\" is starting at 07:00 on 2026-11-14. Get ready!", "class_reminder", null, null);

        verify(dispatcher).dispatch(101L, "Upcoming class reminder",
                "Your class \"Sunrise Yoga\" is starting at 07:00 on 2026-11-14. Get ready!", "class_reminder", null, null);
    }

    /** Kiểm thử: thông báo đánh giá dùng liên kết tiến độ hợp lệ (đã gỡ #coach-evaluations) và nội dung đã bản địa hóa. */
    @Test
    void evaluationNotificationHasSafeProgressLinkAndLocalizedCopy() {
        var messages = org.mockito.Mockito.mock(com.swp391.scms.common.i18n.MessageService.class);
        when(messages.getMessage("notifications.evaluation.title")).thenReturn("Evaluation");
        when(messages.getMessage("notifications.evaluation.body")).thenReturn("View feedback");
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, null, messages);
        var user = new User(); user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        service.notifyEvaluation(101L);
        var captured = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.notifications.entity.Notification.class);
        verify(notificationRepository).save(captured.capture());
        org.junit.jupiter.api.Assertions.assertEquals("/member/progress", captured.getValue().getActionPath());
        org.junit.jupiter.api.Assertions.assertEquals("View feedback", captured.getValue().getMessage());
    }

    /** Kiểm thử P1-BE-51, P2-BE-48, P3-BE-20: chuẩn hóa không phân biệt hoa thường, cắt title 150 ký tự và gắn /coach/classes cho HLV. */
    @Test
    void sendNormalizesCaseInsensitiveTypesClampsTitleAndSetsCoachScheduleActionPath() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        var coachRole = new com.swp391.scms.users.entity.Role();
        coachRole.setCode("COACH");
        var coach = new User();
        coach.setId(202L);
        coach.setRole(coachRole);
        when(userRepository.findByIdAndDeletedAtIsNull(202L)).thenReturn(Optional.of(coach));

        String longTitle = "A".repeat(200);
        service.send(202L, longTitle, "Buổi học đã đổi giờ", "SCHEDULE_CHANGE", "CLASS_SESSION", 55L);

        var saved = org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        assertThat(saved.getValue().getTitle()).hasSize(150);
        assertThat(saved.getValue().getType()).isEqualTo("schedule_change");
        assertThat(saved.getValue().getRelatedEntityType()).isEqualTo("class_session");
        assertThat(saved.getValue().getActionPath()).isEqualTo("/coach/classes");

        var payloadCaptor = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.notifications.port.NotificationPayload.class);
        verify(dispatcher).dispatch(payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().title()).hasSize(150);
        assertThat(payloadCaptor.getValue().type()).isEqualTo("schedule_change");
        assertThat(payloadCaptor.getValue().actionPath()).isEqualTo("/coach/classes");
    }

    /** Kiểm thử: gửi qua kênh ngoài chỉ sau khi commit. */
    @Test
    void sendDispatchesExternalChannelsOnlyAfterCommit() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        var user = new User();
        user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.send(101L, "Title", "Message", "system", null, null);
            verify(notificationRepository).save(any(Notification.class));
            verifyNoInteractions(dispatcher);
            org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
            verify(dispatcher).dispatch(argThat((com.swp391.scms.notifications.port.NotificationPayload p) ->
                    p.userId().equals(101L)
                            && "Title".equals(p.title())
                            && "Message".equals(p.message())
                            && "system".equals(p.type())
                            && p.channels().equals(java.util.Set.of(com.swp391.scms.notifications.port.NotificationChannel.PUSH))));
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /** Kiểm thử: gửi bị từ chối không làm hỏng sau commit. */
    @Test
    void rejectedDispatchDoesNotFailAfterCommit() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        var user = new User();
        user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        doThrow(new org.springframework.core.task.TaskRejectedException("executor full"))
                .when(dispatcher).dispatch(any(com.swp391.scms.notifications.port.NotificationPayload.class));
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.send(101L, "Title", "Message", "system", null, null);
            assertThatCode(() -> org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit)).doesNotThrowAnyException();
            verify(dispatcher).dispatch(any(com.swp391.scms.notifications.port.NotificationPayload.class));
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationMapper notificationMapper;

    @InjectMocks
    private NotificationService notificationService;

    /** Kiểm thử: lấy thông báo của người dùng thành công. */
    @Test
    @DisplayName("getUserNotifications returns paginated notifications for user")
    void getUserNotifications_Success() {
        User user = new User();
        user.setId(101L);
        Notification entity = new Notification(user, "Title", "Body", "system", "support_request", 1L);
        NotificationDto dto = new NotificationDto(1L, "Title", "Body", "system", "support_request", 1L, false, LocalDateTime.now());
        PageRequest pageable = PageRequest.of(0, 20);

        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(101L, pageable))
                .thenReturn(new PageImpl<>(List.of(entity), pageable, 1));
        when(notificationMapper.toDto(entity)).thenReturn(dto);

        Page<NotificationDto> result = notificationService.getUserNotifications(101L, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).title()).isEqualTo("Title");
    }

    /** Kiểm thử: lấy số chưa đọc thành công. */
    @Test
    @DisplayName("getUnreadCount returns count of unread notifications")
    void getUnreadCount_Success() {
        when(notificationRepository.countByUserIdAndIsReadFalse(101L)).thenReturn(3L);

        assertThat(notificationService.getUnreadCount(101L)).isEqualTo(3L);
    }

    /** Kiểm thử: đánh dấu đã đọc thành công. */
    @Test
    @DisplayName("markAsRead marks unread notification as read")
    void markAsRead_Success() {
        User user = new User();
        user.setId(101L);
        Notification notification = new Notification(user, "Title", "Body", "system", null, null);
        when(notificationRepository.findByIdAndUserId(10L, 101L)).thenReturn(Optional.of(notification));

        notificationService.markAsRead(10L, 101L);

        assertThat(notification.isRead()).isTrue();
        verify(notificationRepository).save(notification);
    }

    /** Kiểm thử: đánh dấu đã đọc không tìm thấy thông báo. */
    @Test
    @DisplayName("markAsRead throws 404 when notification not found or belongs to another user")
    void markAsRead_NotFound() {
        when(notificationRepository.findByIdAndUserId(99L, 101L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead(99L, 101L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    /** Kiểm thử: đánh dấu tất cả đã đọc thành công. */
    @Test
    @DisplayName("markAllAsRead delegates to repository")
    void markAllAsRead_Success() {
        notificationService.markAllAsRead(101L);

        verify(notificationRepository).markAllAsReadByUserId(101L);
    }

    /** Kiểm thử: gửi thông báo thành công. */
    @Test
    @DisplayName("send saves notification when user is active and not soft-deleted")
    void send_Success() {
        User user = new User();
        user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        notificationService.send(101L, "Title", "Message", "support_reply", "support_request", 5L);

        verify(notificationRepository).save(any(Notification.class));
    }

    /** Kiểm thử: gửi cho người dùng đã xóa mềm ném not found. */
    @Test
    @DisplayName("send throws ResourceNotFoundException when user is soft-deleted or missing")
    void send_SoftDeletedUser_ThrowsNotFound() {
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.send(101L, "Title", "Message", "system", null, null))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(notificationRepository, never()).save(any());
    }

    /** Kiểm thử: thông báo đánh giá cho người dùng đã xóa mềm không ném lỗi. */
    @Test
    @DisplayName("notifyEvaluation skips without throwing when member user account is soft-deleted or missing")
    void notifyEvaluation_SoftDeletedUser_DoesNotThrow() {
        when(userRepository.findByIdAndDeletedAtIsNull(2L)).thenReturn(Optional.empty());

        notificationService.notifyEvaluation(2L);

        verify(notificationRepository, never()).save(any());
    }

    /** Kiểm thử: gửi thông báo chuẩn hóa các giá trị ràng buộc CHECK của database. */
    @Test
    @DisplayName("send normalizes type and relatedEntityType to satisfy PostgreSQL check constraints while preserving raw values for external dispatch")
    void sendNormalizesDatabaseCheckConstraintValues() {
        var dispatcher = mock(com.swp391.scms.notifications.port.NotificationDispatcher.class);
        var service = new NotificationService(notificationRepository, userRepository, notificationMapper, dispatcher);
        User user = new User();
        user.setId(101L);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        service.send(101L, "Nạp ví", "Đã cộng tiền", "payment", "wallet", 10L, "/member/packages");
        service.send(101L, "Đơn hàng", "Hoàn tiền đơn hàng", "order", "product_order", 20L, "/member/orders/20");
        service.send(101L, "Bảo mật", "Đổi mật khẩu", "system", "password_changed", 101L);

        var saved = org.mockito.ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(3)).save(saved.capture());
        List<Notification> captured = saved.getAllValues();

        assertThat(captured.get(0).getType()).isEqualTo("payment");
        assertThat(captured.get(0).getRelatedEntityType()).isEqualTo("payment");
        assertThat(Notification.ALLOWED_TYPES).contains(captured.get(0).getType());
        assertThat(Notification.ALLOWED_ENTITY_TYPES).contains(captured.get(0).getRelatedEntityType());

        assertThat(captured.get(1).getType()).isEqualTo("payment");
        assertThat(captured.get(1).getRelatedEntityType()).isEqualTo("payment");

        assertThat(captured.get(2).getType()).isEqualTo("system");
        assertThat(captured.get(2).getRelatedEntityType()).isNull();
    }

    /** Kiểm thử: Spring context phân giải được constructor autowired. */
    @Test
    @DisplayName("Spring context verifies Autowired constructor exists and bean instantiates without NoSuchMethodException")
    void springContextResolvesAutowiredConstructor() {
        org.springframework.context.annotation.AnnotationConfigApplicationContext context =
                new org.springframework.context.annotation.AnnotationConfigApplicationContext();
        context.getDefaultListableBeanFactory().registerSingleton("notificationRepository", notificationRepository);
        context.getDefaultListableBeanFactory().registerSingleton("userRepository", userRepository);
        context.getDefaultListableBeanFactory().registerSingleton("notificationMapper", notificationMapper);
        context.register(NotificationService.class);
        context.refresh();

        NotificationService bean = context.getBean(NotificationService.class);
        assertThat(bean).isNotNull();
        context.close();
    }
}
