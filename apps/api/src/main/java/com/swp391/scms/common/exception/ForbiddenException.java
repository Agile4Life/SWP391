package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lỗi không đủ quyền thực hiện thao tác (HTTP 403).
 *
 * Thrown when an authenticated user does not have permission for an action (HTTP 403).
 */
public class ForbiddenException extends AppException {

    /** Lỗi 403 với mã lỗi mặc định FORBIDDEN. */
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    /** Lỗi 403 với mã lỗi riêng. */
    public ForbiddenException(String errorCode, String message) {
        super(HttpStatus.FORBIDDEN, errorCode, message);
    }

    /** Lỗi 403 có message key để dịch. */
    public ForbiddenException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.FORBIDDEN, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
