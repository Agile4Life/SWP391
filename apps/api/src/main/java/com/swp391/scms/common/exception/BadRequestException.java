package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lỗi dữ liệu đầu vào không hợp lệ (HTTP 400).
 *
 * Ném khi request của client không hợp lệ hoặc sai định dạng (HTTP 400).
 */
public class BadRequestException extends AppException {

    /** Lỗi 400 với mã lỗi mặc định BAD_REQUEST. */
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, "BAD_REQUEST", message);
    }

    /** Lỗi 400 với mã lỗi riêng. */
    public BadRequestException(String errorCode, String message) {
        super(HttpStatus.BAD_REQUEST, errorCode, message);
    }

    /** Lỗi 400 với mã lỗi riêng và details. */
    public BadRequestException(String errorCode, String message, Object details) {
        super(HttpStatus.BAD_REQUEST, errorCode, message, details);
    }

    /** Lỗi 400 có message key để dịch. */
    public BadRequestException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.BAD_REQUEST, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
