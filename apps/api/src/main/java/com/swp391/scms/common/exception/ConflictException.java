package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lỗi xung đột trạng thái (HTTP 409): ví dụ trùng dữ liệu, đã có yêu cầu đang chờ, dữ liệu vừa bị người khác
 * thay đổi.
 *
 * Thrown when a conflict occurs with the current state of a resource (HTTP 409).
 */
public class ConflictException extends AppException {

    /** Lỗi 409 với mã lỗi mặc định CONFLICT. */
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, "CONFLICT", message);
    }

    /** Lỗi 409 với mã lỗi riêng. */
    public ConflictException(String errorCode, String message) {
        super(HttpStatus.CONFLICT, errorCode, message);
    }

    /** Lỗi 409 với mã lỗi riêng và details. */
    public ConflictException(String errorCode, String message, Object details) {
        super(HttpStatus.CONFLICT, errorCode, message, details);
    }

    /** Lỗi 409 có message key để dịch. */
    public ConflictException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.CONFLICT, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
