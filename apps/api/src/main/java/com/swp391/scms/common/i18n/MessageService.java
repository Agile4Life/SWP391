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
 * Service phân giải thông báo đã bản địa hóa từ các bundle message i18n. Dùng locale của request từ
 * LocaleContextHolder (theo header Accept-Language).
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
     * Phân giải một message theo Locale của luồng hiện tại.
     *
     * @param code mã/khóa thông báo trong messages.properties
     * @param args các tham số tùy chọn để thay thế placeholder ({0}, {1}, ...)
     * @return thông báo đã bản địa hóa, hoặc chính mã nếu không tìm thấy
     */
    public String getMessage(String code, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        return getMessage(code, locale, args);
    }

    /**
     * Dịch mã thông báo theo một ngôn ngữ chỉ định (dùng khi gửi thông báo cho người khác, không phải người
     * đang gọi API).
     *
     * Phân giải một message theo một Locale cụ thể.
     *
     * @param code mã/khóa thông báo
     * @param locale locale chỉ định
     * @param args các tham số tùy chọn
     * @return thông báo đã bản địa hóa, hoặc chính mã nếu không tìm thấy
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
     * Phân giải một message kèm văn bản dự phòng nếu mã không tồn tại.
     *
     * @param code mã/khóa thông báo
     * @param defaultMessage chuỗi dự phòng
     * @param args các tham số tùy chọn
     * @return thông báo đã bản địa hóa hoặc defaultMessage
     */
    public String getMessageOrDefault(String code, String defaultMessage, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        return messageSource.getMessage(code, args, defaultMessage, locale);
    }
}
