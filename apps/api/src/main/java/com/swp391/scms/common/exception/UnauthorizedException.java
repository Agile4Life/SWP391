package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lỗi chưa xác thực hoặc thông tin đăng nhập sai (HTTP 401).
 *
 * Thrown when an unauthenticated user attempts an action (HTTP 401).
 */
public class UnauthorizedException extends AppException {

    /** Lỗi 401 với mã lỗi mặc định UNAUTHORIZED. */
    public UnauthorizedException(String message) {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
    }

    /** Lỗi 401 với mã lỗi riêng. */
    public UnauthorizedException(String errorCode, String message) {
        super(HttpStatus.UNAUTHORIZED, errorCode, message);
    }

    /** Lỗi 401 có message key để dịch. */
    public UnauthorizedException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.UNAUTHORIZED, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
