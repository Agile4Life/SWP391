package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/** Lỗi dịch vụ tạm thời không sẵn sàng (HTTP 503), ví dụ nhà cung cấp AI hoặc gửi OTP đang lỗi. */
public class ServiceUnavailableException extends AppException {
    /** Lỗi 503 với thông báo cố định. */
    public ServiceUnavailableException(String message) {
        super(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", message);
    }

    /** Lỗi 503 có message key để dịch. */
    public ServiceUnavailableException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.SERVICE_UNAVAILABLE, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}
