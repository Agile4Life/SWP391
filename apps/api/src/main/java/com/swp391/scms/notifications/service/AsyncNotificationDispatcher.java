package com.swp391.scms.notifications.service;

import com.swp391.scms.notifications.port.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

/**
 * Triển khai bộ phát thông báo đa kênh bất đồng bộ (SCRUM-108).
 * Phát thông báo đồng thời qua các kênh Port & Adapter trên thread pool riêng mà không chặn luồng xử lý request chính.
 */
@Service
@Async("notificationTaskExecutor")
public class AsyncNotificationDispatcher implements NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(AsyncNotificationDispatcher.class);

    private final List<NotificationChannelAdapter> channelAdapters;

    /** Nhận danh sách mọi kênh (adapter) mà Spring tìm thấy. */
    @Autowired
    public AsyncNotificationDispatcher(List<NotificationChannelAdapter> channelAdapters) {
        this.channelAdapters = channelAdapters != null ? channelAdapters : List.of();
    }

    /** Phát thông báo theo payload có sẵn. */
    @Async("notificationTaskExecutor")
    @Override
    public void dispatch(NotificationPayload payload) {
        executeDispatch(payload);
    }

    /** Phát thông báo tới ba kênh mặc định: trong ứng dụng, email và đẩy. */
    @Async("notificationTaskExecutor")
    @Override
    public void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId) {
        NotificationPayload payload = NotificationPayload.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .type(type)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .channels(Set.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH))
                .build();
        executeDispatch(payload);
    }

    /** Phát thông báo tới các kênh được chỉ định. */
    @Async("notificationTaskExecutor")
    @Override
    public void dispatch(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId, Set<NotificationChannel> channels) {
        NotificationPayload payload = NotificationPayload.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .type(type)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .channels(channels)
                .build();
        executeDispatch(payload);
    }

    /**
     * Gửi payload qua từng kênh nằm trong danh sách kênh đích; lỗi ở một kênh chỉ ghi log và không chặn kênh
     * khác.
     */
    private void executeDispatch(NotificationPayload payload) {
        if (payload == null) {
            log.warn("[NotificationDispatcher] Discarding null notification payload");
            return;
        }

        log.debug("[NotificationDispatcher] Dispatching notification to User #{} via thread: {}",
                payload.userId(), Thread.currentThread().getName());

        Set<NotificationChannel> targetChannels = payload.channels();
        for (NotificationChannelAdapter adapter : channelAdapters) {
            if (targetChannels != null && targetChannels.contains(adapter.getChannel())) {
                try {
                    adapter.send(payload);
                } catch (Exception e) {
                    log.error("[NotificationDispatcher] Failed to deliver notification via channel {}: {}",
                            adapter.getChannel(), e.getMessage(), e);
                }
            }
        }
    }
}
