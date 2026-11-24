package com.swp391.scms.notifications;

import com.swp391.scms.common.i18n.MessageService;
import org.springframework.context.support.ResourceBundleMessageSource;

/** Bộ kiểm thử cho NotificationTestMessages (notification test messages). */
final class NotificationTestMessages {
    /** Constructor riêng tư: lớp tiện ích không cho khởi tạo. */
    private NotificationTestMessages() {}

    /** Hàm trợ giúp của test: tạo NotificationLocalizer dùng bundle thật. */
    static NotificationLocalizer localizer() {
        var source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return new NotificationLocalizer(new MessageService(source));
    }
}
