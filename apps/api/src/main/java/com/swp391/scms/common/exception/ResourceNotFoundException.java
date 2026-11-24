package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Lỗi không tìm thấy tài nguyên (HTTP 404).
 *
 * Thrown when a requested resource is not found (HTTP 404).
 */
public class ResourceNotFoundException extends AppException {

    /** Lỗi 404 với thông báo cố định. */
    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    /**
     * Lỗi 404 theo tên tài nguyên và mã định danh, ví dụ ("resource.member", 12); tên tài nguyên được dịch khi
     * trả về.
     */
    public ResourceNotFoundException(String resourceName, Object identifier) {
        super(HttpStatus.NOT_FOUND, "NOT_FOUND", "error.not_found", new Object[]{resourceName, identifier}, null);
    }

    /** Lỗi 404 có message key để dịch. */
    public ResourceNotFoundException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.NOT_FOUND, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
