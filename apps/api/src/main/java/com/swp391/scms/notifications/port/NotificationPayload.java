package com.swp391.scms.notifications.port;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Set;

/**
 * Immutable payload data transferring notification information across channels (SCRUM-108).
 */
public record NotificationPayload(
        Long userId,
        String recipientEmail,
        String title,
        String message,
        String type,
        String relatedEntityType,
        Long relatedEntityId,
        Set<NotificationChannel> channels,
        LocalDateTime timestamp
) {
    public NotificationPayload {
        if (channels == null || channels.isEmpty()) {
            channels = Set.of(NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH);
        } else {
            channels = Collections.unmodifiableSet(channels);
        }
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long userId;
        private String recipientEmail;
        private String title;
        private String message;
        private String type;
        private String relatedEntityType;
        private Long relatedEntityId;
        private Set<NotificationChannel> channels;
        private LocalDateTime timestamp;

        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        public Builder recipientEmail(String recipientEmail) {
            this.recipientEmail = recipientEmail;
            return this;
        }

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder message(String message) {
            this.message = message;
            return this;
        }

        public Builder type(String type) {
            this.type = type;
            return this;
        }

        public Builder relatedEntityType(String relatedEntityType) {
            this.relatedEntityType = relatedEntityType;
            return this;
        }

        public Builder relatedEntityId(Long relatedEntityId) {
            this.relatedEntityId = relatedEntityId;
            return this;
        }

        public Builder channels(Set<NotificationChannel> channels) {
            this.channels = channels;
            return this;
        }

        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public NotificationPayload build() {
            return new NotificationPayload(
                    userId,
                    recipientEmail,
                    title,
                    message,
                    type,
                    relatedEntityType,
                    relatedEntityId,
                    channels,
                    timestamp
            );
        }
    }
}

