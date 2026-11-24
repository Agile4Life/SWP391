package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Bản gửi OTP "không khả dụng", dùng khi chưa cấu hình kênh gửi: luôn báo lỗi 503 thay vì im lặng không gửi. */
@Component
@ConditionalOnProperty(name = "app.auth.otp.delivery", havingValue = "disabled", matchIfMissing = true)
public class UnavailableOtpDeliveryAdapter implements OtpDeliveryPort {
    /** Luôn ném lỗi 503 "chưa cấu hình gửi OTP". */
    @Override
    public void send(String destination, String code) {
        throw new ServiceUnavailableException("OTP_DELIVERY_DISABLED", "auth.otp.delivery_not_configured", null, null);
    }
}
