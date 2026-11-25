package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ServiceUnavailableException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
    private static final Set<String> LOCALHOST_HOSTS = Set.of("localhost", "127.0.0.1");
    private final VnpayProperties config;
    private final Set<String> allowedOrigins;
    private final boolean allowLocalhostOrigins;

    /** Nhận cấu hình VNPay (chỉ cho phép origin của {@code config.returnUrl()}). */
    public VnpayGateway(VnpayProperties config) {
        this(config, "");
    }

    /** Nhận cấu hình VNPay và danh sách origin frontend được phép quay về sau thanh toán. */
    @Autowired
    public VnpayGateway(VnpayProperties config,
                        @Value("${app.cors.allowed-origins:}") String allowedOriginsCsv) {
        this.config = config;
        this.allowLocalhostOrigins = isLocalhostUrl(config != null ? config.returnUrl() : null);
        this.allowedOrigins = parseAllowedOrigins(config, allowedOriginsCsv, this.allowLocalhostOrigins);
    }

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
     * Link quay về theo origin frontend gửi lên: chỉ chấp nhận khi {@code scheme + host + port} khớp chính xác
     * một origin trong danh sách cấu hình cho phép (hoặc localhost/127.0.0.1 khi {@code config.returnUrl()} cũng
     * là localhost); mọi origin lạ đều quay về {@code config.returnUrl()} để chống Open Redirect.
     */
    public String resolveReturnUrl(String candidateOriginOrUrl) {
        if (candidateOriginOrUrl != null && !candidateOriginOrUrl.isBlank()) {
            String normalized = normalizeOrigin(candidateOriginOrUrl, allowLocalhostOrigins);
            if (normalized != null && (allowedOrigins.contains(normalized)
                    || (allowLocalhostOrigins && isLocalhostUrl(normalized)))) {
                return normalized + "/member/payments/vnpay/return";
            }
        }
        return config.returnUrl();
    }

    private static Set<String> parseAllowedOrigins(VnpayProperties config, String csv, boolean allowLocalhost) {
        Set<String> origins = new LinkedHashSet<>();
        if (config != null && config.returnUrl() != null) {
            String returnOrigin = normalizeOrigin(config.returnUrl(), allowLocalhost);
            if (returnOrigin != null) {
                origins.add(returnOrigin);
            }
        }
        if (csv != null && !csv.isBlank()) {
            for (String entry : csv.split(",")) {
                String trimmed = entry.trim();
                if (trimmed.isEmpty() || trimmed.contains("*")) continue;
                String normalized = normalizeOrigin(trimmed, allowLocalhost);
                if (normalized != null) {
                    origins.add(normalized);
                }
            }
        }
        return Set.copyOf(origins);
    }

    private static boolean isLocalhostUrl(String url) {
        if (url == null || url.isBlank()) return false;
        try {
            URI uri = URI.create(url.trim());
            return uri.getHost() != null && LOCALHOST_HOSTS.contains(uri.getHost().toLowerCase(Locale.ROOT));
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static String normalizeOrigin(String raw, boolean allowLocalhost) {
        if (raw == null || raw.isBlank()) return null;
        try {
            URI uri = URI.create(raw.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || uri.getUserInfo() != null) return null;
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            String normalizedHost = host.toLowerCase(Locale.ROOT);
            boolean localhost = LOCALHOST_HOSTS.contains(normalizedHost);
            if (localhost) {
                if (!allowLocalhost || (!"http".equals(normalizedScheme) && !"https".equals(normalizedScheme))) {
                    return null;
                }
            } else if (!"https".equals(normalizedScheme)) {
                return null;
            }
            int port = uri.getPort();
            boolean defaultPort = ("https".equals(normalizedScheme) && port == 443)
                    || ("http".equals(normalizedScheme) && port == 80);
            String portPart = (port > 0 && !defaultPort) ? (":" + port) : "";
            return normalizedScheme + "://" + normalizedHost + portPart;
        } catch (RuntimeException ignored) {
            return null;
        }
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
