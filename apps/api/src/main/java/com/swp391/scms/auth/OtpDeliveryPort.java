package com.swp391.scms.auth;

/** Cổng gửi mã OTP tới người dùng (email); tách interface để đổi kênh gửi hoặc dùng bản giả khi test. */
public interface OtpDeliveryPort {
    /** Gửi mã OTP tới địa chỉ đích. */
    void send(String destination, String code);
}
