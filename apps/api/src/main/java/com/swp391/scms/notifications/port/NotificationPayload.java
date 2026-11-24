package com.swp391.scms.notifications.port;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Set;

/**
 * Dữ liệu payload bất biến truyền tải thông tin thông báo qua các kênh (SCRUM-108): người nhận, email, tiêu đề,
 * nội dung, loại, bản ghi liên quan, các kênh và thời điểm. Nếu không chỉ định kênh thì mặc định gồm trong ứng
 * dụng, email và đẩy.
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

    /** Bắt đầu dựng payload theo kiểu builder. */
    public static Builder builder() {
        return new Builder();
    }

    /** Builder để dựng NotificationPayload từng trường một. */
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

        /** Gán người nhận. */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /** Gán email người nhận. */
        public Builder recipientEmail(String recipientEmail) {
            this.recipientEmail = recipientEmail;
            return this;
        }

        /** Gán tiêu đề. */
        public Builder title(String title) {
            this.title = title;
            return this;
        }

        /** Gán nội dung. */
        public Builder message(String message) {
            this.message = message;
            return this;
        }

        /** Gán loại thông báo. */
        public Builder type(String type) {
            this.type = type;
            return this;
        }

        /** Gán loại bản ghi liên quan. */
        public Builder relatedEntityType(String relatedEntityType) {
            this.relatedEntityType = relatedEntityType;
            return this;
        }

        /** Gán id bản ghi liên quan. */
        public Builder relatedEntityId(Long relatedEntityId) {
            this.relatedEntityId = relatedEntityId;
            return this;
        }

        /** Gán các kênh gửi. */
        public Builder channels(Set<NotificationChannel> channels) {
            this.channels = channels;
            return this;
        }

        /** Gán thời điểm. */
        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /** Tạo payload từ các giá trị đã gán. */
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

