package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter for simulated mock email dispatching with structured logging (SCRUM-108).
 */
@Component
public class MockEmailNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockEmailNotificationChannelAdapter.class);

    private final UserRepository userRepository;

    public MockEmailNotificationChannelAdapter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.EMAIL;
    }

    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        String recipientEmail = payload.recipientEmail();
        if ((recipientEmail == null || recipientEmail.isBlank()) && payload.userId() != null) {
            recipientEmail = userRepository.findByIdAndDeletedAtIsNull(payload.userId())
                    .map(User::getEmail)
                    .orElse("member-" + payload.userId() + "@solfitness.local");
        }
        if (recipientEmail == null || recipientEmail.isBlank()) {
            recipientEmail = "member-default@solfitness.local";
        }

        log.info("""
                [MOCK-EMAIL] ========================================================
                [MOCK-EMAIL] To: {} (User #{})
                [MOCK-EMAIL] Subject: [SÖL Fitness] {}
                [MOCK-EMAIL] Notification Type: {}
                [MOCK-EMAIL] Related Entity: {} #{}
                [MOCK-EMAIL] Content: {}
                [MOCK-EMAIL] Sent At: {}
                [MOCK-EMAIL] ========================================================""",
                recipientEmail, payload.userId(), payload.title(), payload.type(),
                payload.relatedEntityType(), payload.relatedEntityId(), payload.message(),
                payload.timestamp());
    }
}

