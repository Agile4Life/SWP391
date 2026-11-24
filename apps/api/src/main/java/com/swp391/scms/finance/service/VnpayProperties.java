package com.swp391.scms.finance.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Cấu hình VNPay (app.vnpay.*): bật/tắt, mã TMN, secret ký, link cổng, link quay về và số phút hiệu lực. */
@ConfigurationProperties(prefix = "app.vnpay")
public record VnpayProperties(boolean enabled, String tmnCode, String hashSecret,
        String paymentUrl, String returnUrl, int timeoutMinutes) {}
