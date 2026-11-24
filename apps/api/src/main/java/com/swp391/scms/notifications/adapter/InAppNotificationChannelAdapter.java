package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.NotificationRepository;
import com.swp391.scms.notifications.entity.Notification;
import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter for persisting in-app notifications to the database (SCRUM-108).
 */
@Component
public class InAppNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(InAppNotificationChannelAdapter.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public InAppNotificationChannelAdapter(
            NotificationRepository notificationRepository,
            UserRepository userRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.IN_APP;
    }

    @Override
    public void send(NotificationPayload payload) {
        if (payload == null || payload.userId() == null) {
            log.warn("[IN-APP] Cannot create in-app notification without userId: {}", payload);
            return;
        }

        User user = userRepository.findByIdAndDeletedAtIsNull(payload.userId()).orElse(null);
        if (user == null) {
            log.warn("[IN-APP] User #{} not found or has been deleted; skipping in-app notification", payload.userId());
            return;
        }

        Notification notification = new Notification(
                user,
                payload.title(),
                payload.message(),
                payload.type(),
                payload.relatedEntityType(),
                payload.relatedEntityId()
        );

        notificationRepository.save(notification);
        log.info("[IN-APP] Persisted notification #{} for User #{} (type={}, entity={})",
                notification.getId(), user.getId(), payload.type(), payload.relatedEntityType());
    }
}

