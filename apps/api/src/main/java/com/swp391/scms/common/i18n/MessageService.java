package com.swp391.scms.common.i18n;

import com.swp391.scms.config.I18nConfig;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Dịch mã thông báo (message key) sang tiếng Việt hoặc tiếng Anh theo header Accept-Language của request, dùng
 * các file i18n/messages_vi.properties và messages_en.properties.
 *
 * Service phân giải thông báo đã bản địa hóa từ các bundle message i18n. Dùng locale của request từ
 * LocaleContextHolder (theo header Accept-Language), và mặc định về tiếng Việt ngoài luồng HTTP.
 */
@Service
public class MessageService {

    private final MessageSource messageSource;

    /** Nhận MessageSource của Spring (đã cấu hình đọc các file messages_*.properties). */
    public MessageService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    /** Lấy locale của request hiện tại; ngoài luồng HTTP (khi LocaleContext null) luôn mặc định tiếng Việt. */
    private static Locale resolveCurrentLocale() {
        return LocaleContextHolder.getLocaleContext() != null
                ? LocaleContextHolder.getLocale()
                : I18nConfig.LOCALE_VI;
    }

    /**
     * Dịch mã thông báo theo ngôn ngữ của request hiện tại; không tìm thấy mã thì trả lại chính mã đó.
     */
    public String getMessage(String code, Object... args) {
        return getMessage(code, resolveCurrentLocale(), args);
    }

    /**
     * Dịch mã thông báo theo một ngôn ngữ chỉ định (dùng khi gửi thông báo cho người khác, không phải người
     * đang gọi API).
     */
    public String getMessage(String code, Locale locale, Object... args) {
        if (code == null) {
            return null;
        }
        try {
            return messageSource.getMessage(code, args, locale != null ? locale : resolveCurrentLocale());
        } catch (NoSuchMessageException e) {
            return code;
        }
    }

    /**
     * Dịch mã thông báo; nếu mã null hoặc không tồn tại thì trả câu mặc định được truyền vào.
     */
    public String getMessageOrDefault(String code, String defaultMessage, Object... args) {
        if (code == null) {
            return defaultMessage;
        }
        Locale locale = resolveCurrentLocale();
        return messageSource.getMessage(code, args, defaultMessage, locale);
    }
}
