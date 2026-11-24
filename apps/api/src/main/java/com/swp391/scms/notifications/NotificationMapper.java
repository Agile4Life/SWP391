package com.swp391.scms.notifications;

import com.swp391.scms.notifications.dto.NotificationDto;
import com.swp391.scms.notifications.entity.Notification;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/** Chuyển entity thông báo sang DTO; khi request dùng tiếng Việt thì dịch các thông báo tiếng Anh cũ. */
@Component
public class NotificationMapper {
    private final NotificationLocalizer localizer;

    /** Nhận bộ dịch thông báo cũ. */
    public NotificationMapper(NotificationLocalizer localizer) {
        this.localizer = localizer;
    }

    /** Tạo NotificationDto (tiêu đề/nội dung dịch sang tiếng Việt nếu ngôn ngữ request là vi). */
    public NotificationDto toDto(Notification entity) {
        if (entity == null) return null;
        boolean vietnamese = "vi".equals(LocaleContextHolder.getLocale().getLanguage());
        return new NotificationDto(
            entity.getId(),
            vietnamese ? localizer.localizeTitle(entity.getTitle()) : entity.getTitle(),
            vietnamese ? localizer.localizeMessage(entity.getMessage()) : entity.getMessage(),
            entity.getType(),
            entity.getRelatedEntityType(),
            entity.getRelatedEntityId(),
            entity.isRead(),
            entity.getCreatedAt(),
            entity.getActionPath()
        );
    }
}
