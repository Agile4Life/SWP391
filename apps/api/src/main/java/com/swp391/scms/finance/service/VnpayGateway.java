package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ServiceUnavailableException;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Adapter cổng VNPay (giao thức PAY 2.1.0): dựng link thanh toán với các trường sắp xếp, mã hóa URL và ký
 * HMAC-SHA512; kiểm tra chữ ký callback. Thông tin bí mật không bao giờ rời khỏi adapter này.
 */
@Component
@EnableConfigurationProperties(VnpayProperties.class)
public class VnpayGateway {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final VnpayProperties config;
    /** Nhận cấu hình VNPay. */
    public VnpayGateway(VnpayProperties config) { this.config = config; }

    /**
     * VNPay có bật và cấu hình hợp lệ không: có secret, mã TMN 8 ký tự, thời gian chờ 1-60 phút, link thanh
     * toán là HTTPS sandbox, link quay về là HTTPS (hoặc http localhost).
     */
    public boolean enabled() {
        if (!config.enabled() || config.hashSecret() == null || config.hashSecret().isBlank()
                || config.tmnCode() == null || !config.tmnCode().matches("[A-Za-z0-9]{8}")
                || config.timeoutMinutes() < 1 || config.timeoutMinutes() > 60) return false;
        try {
            URI pay = URI.create(config.paymentUrl());
            URI back = URI.create(config.returnUrl());
            return "https".equals(pay.getScheme()) && pay.getUserInfo() == null && pay.getQuery() == null
                    && "sandbox.vnpayment.vn".equals(pay.getHost())
                    && back.getHost() != null && back.getUserInfo() == null && back.getFragment() == null && back.getQuery() == null
                    && ("https".equals(back.getScheme()) || ("http".equals(back.getScheme())
                        && Set.of("localhost", "127.0.0.1").contains(back.getHost())));
        } catch (RuntimeException e) { return false; }
    }
    /** Bắt buộc VNPay đang bật; không thì báo 503. */
    public void requireEnabled() {
        if (!enabled()) throw new ServiceUnavailableException("VNPAY_UNAVAILABLE", "finance.vnpay.unavailable", null, null);
    }
    /** Số phút hiệu lực của một lượt thanh toán. */
    public int timeoutMinutes() { return config.timeoutMinutes(); }
    /** Link thanh toán dùng link quay về mặc định. */
    public String paymentUrl(String reference, BigDecimal amount, LocalDateTime created, LocalDateTime expires, String ip) {
        return paymentUrl(reference, amount, created, expires, ip, null);
    }

    /**
     * Dựng link thanh toán: số tiền phải là số nguyên dương hợp lệ; IP không hợp lệ thì dùng 127.0.0.1; điền
     * các trường vnp_*, ký và nối vào link cổng.
     */
    public String paymentUrl(String reference, BigDecimal amount, LocalDateTime created, LocalDateTime expires, String ip, String returnUrlOverride) {
        requireEnabled();
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 0
                || amount.multiply(BigDecimal.valueOf(100)).toBigInteger().toString().length() > 12) {
            throw new BadRequestException("VNPAY_INVALID_AMOUNT", "finance.vnpay.invalid_amount", null, null);
        }
        String normalizedIp = (ip == null || ip.isBlank() || ip.contains(":")) ? "127.0.0.1" : ip.trim();
        String effectiveReturnUrl = resolveReturnUrl(returnUrlOverride);
        var fields = new TreeMap<String,String>();
        fields.put("vnp_Version", "2.1.0"); fields.put("vnp_Command", "pay");
        fields.put("vnp_TmnCode", config.tmnCode().trim()); fields.put("vnp_Amount", amount.multiply(BigDecimal.valueOf(100)).toBigIntegerExact().toString());
        fields.put("vnp_CurrCode", "VND"); fields.put("vnp_TxnRef", reference);
        fields.put("vnp_OrderInfo", "SOL Fitness payment " + reference); fields.put("vnp_OrderType", "other");
        fields.put("vnp_Locale", "vn"); fields.put("vnp_ReturnUrl", effectiveReturnUrl);
        fields.put("vnp_IpAddr", normalizedIp); fields.put("vnp_CreateDate", created.format(DATE)); fields.put("vnp_ExpireDate", expires.format(DATE));
        return config.paymentUrl() + "?" + canonical(fields) + "&vnp_SecureHash=" + sign(fields);
    }

    /**
     * Link quay về theo địa chỉ frontend gửi lên (chỉ nhận HTTPS hoặc http localhost); không hợp lệ thì dùng
     * link cấu hình.
     */
    private String resolveReturnUrl(String candidateOriginOrUrl) {
        if (candidateOriginOrUrl != null && !candidateOriginOrUrl.isBlank()) {
            try {
                URI uri = URI.create(candidateOriginOrUrl.trim());
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (host != null && ("https".equalsIgnoreCase(scheme)
                        || ("http".equalsIgnoreCase(scheme) && Set.of("localhost", "127.0.0.1").contains(host)))) {
                    String portPart = uri.getPort() > 0 ? (":" + uri.getPort()) : "";
                    return scheme.toLowerCase(Locale.ROOT) + "://" + host + portPart + "/member/payments/vnpay/return";
                }
            } catch (RuntimeException ignored) {
            }
        }
        return config.returnUrl();
    }

    /** Kiểm tra chữ ký callback: đúng mã TMN, chữ ký đúng 128 ký tự hex và khớp (so sánh thời gian hằng). */
    public boolean validSignature(Map<String,String> fields) {
        if (!enabled() || !config.tmnCode().trim().equals(fields.get("vnp_TmnCode"))) return false;
        String supplied = fields.get("vnp_SecureHash");
        if (supplied == null || !supplied.matches("[0-9a-fA-F]{128}")) return false;
        return MessageDigest.isEqual(HexFormat.of().parseHex(supplied), HexFormat.of().parseHex(sign(fields)));
    }
    /** Ký chuỗi chuẩn hóa bằng HMAC-SHA512 với secret. */
    public String sign(Map<String,String> fields) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(config.hashSecret().trim().getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(canonical(fields).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
    /** Chuỗi chuẩn hóa để ký: các trường vnp_* (trừ chữ ký) có giá trị, sắp theo tên, mã hóa URL, nối bằng &. */
    private String canonical(Map<String,String> fields) {
        return new TreeMap<>(fields).entrySet().stream()
                .filter(e -> e.getKey() != null && e.getKey().startsWith("vnp_"))
                .filter(e -> !Set.of("vnp_SecureHash", "vnp_SecureHashType").contains(e.getKey()))
                .filter(e -> e.getValue() != null && !e.getValue().isEmpty())
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }
}
