package com.swp391.scms.membership.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Băm số CCCD bằng HMAC-SHA256 với pepper phía server để không lưu số định danh dạng đọc được
 * nhưng vẫn kiểm tra trùng lặp được. Chỉ giữ 4 số cuối để hiển thị.
 */
@Component
public class CccdHasher {

    private final byte[] pepper;

    /** Nhận pepper bí mật (app.trial.cccd-pepper, mặc định JWT secret) dùng để băm và dẫn xuất khóa mã hóa. */
    public CccdHasher(@Value("${app.trial.cccd-pepper:${app.jwt.secret}}") String pepper) {
        this.pepper = pepper.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Băm số giấy tờ bằng HMAC-SHA256 với pepper, trả chuỗi hex; cùng số luôn cho cùng mã băm nên kiểm tra
     * trùng được mà không lưu số thật.
     */
    public String hash(String cccd) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            byte[] digest = mac.doFinal(cccd.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }

    /** AES-GCM (khóa dẫn xuất từ pepper) để lễ tân xem số đầy đủ khi đơn đang chờ duyệt; cột này bị xóa khi đơn được xử lý. */
    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, aesKey(), new GCMParameterSpec(128, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("AES-GCM unavailable", e);
        }
    }

    /** Null khi chưa có dữ liệu hoặc khóa đã đổi (khi đó giao diện quay về số che). */
    public String decrypt(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) return null;
        try {
            byte[] in = Base64.getDecoder().decode(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, aesKey(), new GCMParameterSpec(128, in, 0, 12));
            return new String(cipher.doFinal(in, 12, in.length - 12), StandardCharsets.UTF_8);
        } catch (java.security.GeneralSecurityException | IllegalArgumentException e) {
            return null;
        }
    }

    /** Dẫn xuất khóa AES 256-bit từ SHA-256 của pepper. */
    private javax.crypto.spec.SecretKeySpec aesKey() throws java.security.GeneralSecurityException {
        return new javax.crypto.spec.SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(pepper), "AES");
    }

    /** 4 ký tự cuối của số giấy tờ (dùng để hiển thị). */
    public String last4(String cccd) {
        return cccd.length() <= 4 ? cccd : cccd.substring(cccd.length() - 4);
    }

    /** Dạng che "********" + 4 số cuối. */
    public String mask(String last4) {
        return last4 == null ? null : "********" + last4;
    }
}
