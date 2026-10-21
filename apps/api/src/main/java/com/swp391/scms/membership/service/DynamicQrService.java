package com.swp391.scms.membership.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Quản lý sinh và xác thực Dynamic QR bảo mật theo định dạng HMAC-SHA256(userId + subscriptionId + timestamp).
 * Có thời hạn sống ngắn (TTL) ngăn chặn triệt để hành vi quét cạn hoặc chụp màn hình chia sẻ thẻ gian lận.
 */
@Service
public class DynamicQrService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    public static final long DEFAULT_TTL_SECONDS = 60; // 60 giây thời hạn sống

    private final byte[] secretKeyBytes;
    private final long ttlMillis;

    public DynamicQrService() {
        this(UUID.randomUUID().toString() + UUID.randomUUID(), DEFAULT_TTL_SECONDS);
    }

    @Autowired
    public DynamicQrService(
            @Value("${app.qr.secret:${app.jwt.secret}}") String secret,
            @Value("${app.qr.ttl-seconds:60}") long ttlSeconds) {
        if (secret == null || secret.isBlank() || ttlSeconds <= 0) {
            throw new IllegalArgumentException("QR signing secret and positive lifetime are required");
        }
        this.secretKeyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlMillis = ttlSeconds * 1000L;
    }

    public long getTtlSeconds() {
        return ttlMillis / 1000L;
    }

    public record VerificationResult(
            boolean valid,
            boolean expired,
            boolean isDynamic,
            Long userId,
            Long subscriptionId
    ) {
        public static VerificationResult notDynamic() {
            return new VerificationResult(false, false, false, null, null);
        }

        public static VerificationResult invalid(boolean expired) {
            return new VerificationResult(false, expired, true, null, null);
        }

        public static VerificationResult success(Long userId, Long subscriptionId) {
            return new VerificationResult(true, false, true, userId, subscriptionId);
        }
    }

    /**
     * Sinh chuỗi Dynamic QR định dạng: DYN:{userId}:{subscriptionId}:{timestampMillis}:{hmacHex}
     */
    public String generate(Long userId, Long subscriptionId, long nowMillis) {
        String data = userId + ":" + subscriptionId + ":" + nowMillis;
        String signature = computeHmac(data);
        return "DYN:" + data + ":" + signature;
    }

    public boolean isDynamic(String qrCode) {
        return qrCode != null && qrCode.startsWith("DYN:");
    }

    /**
     * Xác thực Dynamic QR: kiểm tra chữ ký HMAC-SHA256 và kiểm tra thời hạn sống ngắn (TTL).
     */
    public VerificationResult verify(String qrCode, long currentMillis) {
        if (!isDynamic(qrCode)) {
            return VerificationResult.notDynamic();
        }

        String[] parts = qrCode.split(":");
        if (parts.length != 5) {
            return VerificationResult.invalid(false);
        }

        try {
            Long userId = Long.parseLong(parts[1]);
            Long subscriptionId = Long.parseLong(parts[2]);
            long timestampMillis = Long.parseLong(parts[3]);
            String receivedSignature = parts[4];

            // 1. Kiểm tra tính toàn vẹn HMAC
            String data = userId + ":" + subscriptionId + ":" + timestampMillis;
            String expectedSignature = computeHmac(data);
            if (!MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    receivedSignature.getBytes(StandardCharsets.UTF_8))) {
                return VerificationResult.invalid(false);
            }

            // 2. Kiểm tra thời hạn sống ngắn (TTL) - dung sai lệch đồng hồ 15 giây
            if (currentMillis - timestampMillis > ttlMillis || timestampMillis - currentMillis > 15000L) {
                return VerificationResult.invalid(true);
            }

            return VerificationResult.success(userId, subscriptionId);
        } catch (Exception e) {
            return VerificationResult.invalid(false);
        }
    }

    private String computeHmac(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secretKeyBytes, HMAC_ALGORITHM));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to calculate HMAC-SHA256", e);
        }
    }
}
