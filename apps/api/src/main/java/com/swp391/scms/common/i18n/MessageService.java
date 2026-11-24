package com.swp391.scms.common.i18n;

import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Dịch mã thông báo (message key) sang tiếng Việt hoặc tiếng Anh theo header Accept-Language của request, dùng
 * các file i18n/messages_vi.properties và messages_en.properties.
 *
 * Service for resolving localized messages from i18n message bundles.
 * Uses request locale from LocaleContextHolder (driven by Accept-Language header).
 */
@Service
public class MessageService {

    private final MessageSource messageSource;

    /** Nhận MessageSource của Spring (đã cấu hình đọc các file messages_*.properties). */
    public MessageService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    /**
     * Dịch mã thông báo theo ngôn ngữ của request hiện tại; không tìm thấy mã thì trả lại chính mã đó.
     *
     * Resolves a message for the current thread's Locale.
     *
     * @param code the message code/key in messages.properties
     * @param args optional arguments for placeholder substitution ({0}, {1}, ...)
     * @return the localized message, or the code itself if not found
     */
    public String getMessage(String code, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        return getMessage(code, locale, args);
    }

    /**
     * Dịch mã thông báo theo một ngôn ngữ chỉ định (dùng khi gửi thông báo cho người khác, không phải người
     * đang gọi API).
     *
     * Resolves a message for a specific Locale.
     *
     * @param code the message code/key
     * @param locale explicit locale
     * @param args optional arguments
     * @return the localized message, or the code itself if not found
     */
    public String getMessage(String code, Locale locale, Object... args) {
        try {
            return messageSource.getMessage(code, args, locale != null ? locale : LocaleContextHolder.getLocale());
        } catch (NoSuchMessageException e) {
            return code;
        }
    }

    /**
     * Dịch mã thông báo; nếu mã không tồn tại thì trả câu mặc định được truyền vào.
     *
     * Resolves a message with a default fallback text if the code is not present.
     *
     * @param code the message code/key
     * @param defaultMessage fallback text
     * @param args optional arguments
     * @return the localized message or defaultMessage
     */
    public String getMessageOrDefault(String code, String defaultMessage, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        return messageSource.getMessage(code, args, defaultMessage, locale);
    }
}
