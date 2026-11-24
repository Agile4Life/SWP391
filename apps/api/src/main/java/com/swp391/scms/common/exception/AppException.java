package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lớp gốc cho mọi lỗi nghiệp vụ: mang mã HTTP, mã lỗi máy đọc được (errorCode), message key để dịch, tham số
 * của câu và details. GlobalExceptionHandler đọc các trường này để tạo phản hồi.
 *
 * Ngoại lệ runtime tùy chỉnh gốc của ứng dụng SCMS có hỗ trợ i18n.
 */
public class AppException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final String messageKey;
    private final Object[] messageArgs;
    private final Object details;

    /** Tạo lỗi với thông báo cố định (không dịch) kèm details. */
    public AppException(HttpStatus status, String errorCode, String message, Object details) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.messageKey = null;
        this.messageArgs = null;
        this.details = details;
    }

    /** Tạo lỗi với thông báo cố định, không có details. */
    public AppException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, null);
    }

    /** Tạo lỗi có message key để dịch theo ngôn ngữ của request; fallbackMessage dùng khi không dịch được. */
    public AppException(HttpStatus status, String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(fallbackMessage != null ? fallbackMessage : messageKey);
        this.status = status;
        this.errorCode = errorCode;
        this.messageKey = messageKey;
        this.messageArgs = messageArgs;
        this.details = null;
    }

    /** Lấy giá trị trường status. */
    public HttpStatus getStatus() {
        return status;
    }

    /** Lấy giá trị trường errorCode. */
    public String getErrorCode() {
        return errorCode;
    }

    /** Lấy giá trị trường messageKey. */
    public String getMessageKey() {
        return messageKey;
    }

    /** Lấy giá trị trường messageArgs. */
    public Object[] getMessageArgs() {
        return messageArgs;
    }

    /** Lấy giá trị trường details. */
    public Object getDetails() {
        return details;
    }
}
