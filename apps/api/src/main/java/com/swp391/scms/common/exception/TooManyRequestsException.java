package com.swp391.scms.common.exception;

import org.springframework.http.HttpStatus;

/** Lỗi gọi quá nhiều lần trong thời gian ngắn (HTTP 429), dùng cho giới hạn tần suất như gửi OTP hay chat AI. */
public class TooManyRequestsException extends AppException {
    /** Lỗi 429 với mã lỗi riêng. */
    public TooManyRequestsException(String errorCode, String message) {
        super(HttpStatus.TOO_MANY_REQUESTS, errorCode, message);
    }

    /** Lỗi 429 có message key để dịch. */
    public TooManyRequestsException(String errorCode, String messageKey, Object[] messageArgs, String fallbackMessage) {
        super(HttpStatus.TOO_MANY_REQUESTS, errorCode, messageKey, messageArgs, fallbackMessage);
    }
}