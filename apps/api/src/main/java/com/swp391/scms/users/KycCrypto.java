package com.swp391.scms.users;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Mã hóa số CCCD/hộ chiếu khi lưu bằng AES-256-GCM. Database không bao giờ chứa số đọc được; hội viên chỉ thấy
 * dạng che, người duyệt giải mã qua màn duyệt KYC.
 *
 * Mã hóa số định danh (CCCD hoặc hộ chiếu) khi lưu bằng AES-256-GCM. Số đọc được không bao giờ nằm trong
 * database; hội viên chỉ thấy dạng che, còn người duyệt giải mã nó qua endpoint duyệt.
 */
@Component
public class KycCrypto {
    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    /** Tạo khóa AES 256-bit từ SHA-256 của app.kyc.encryption-key (mặc định dùng JWT secret). */
    public KycCrypto(@Value("${app.kyc.encryption-key:${app.jwt.secret}}") String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /**
     * Mã hóa chuỗi: sinh IV ngẫu nhiên 12 byte, mã hóa AES-GCM, ghép IV + dữ liệu rồi base64, thêm tiền tố
     * "enc:v1:" để nhận biết phiên bản.
     */
    public String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] joined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, joined, 0, iv.length);
            System.arraycopy(encrypted, 0, joined, iv.length, encrypted.length);
            return PREFIX + Base64.getEncoder().encodeToString(joined);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the identity number", e);
        }
    }

    /**
     * Giải mã chuỗi do encrypt() tạo ra; trả null nếu thiếu, sai định dạng hoặc không giải mã được (khóa sai,
     * dữ liệu bị sửa).
     *
     * Số đọc được, hoặc null khi giá trị thiếu hoặc không do {@link #encrypt} tạo ra.
     */
    public String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return null;
        try {
            byte[] joined = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, joined, 0, IV_BYTES));
            return new String(cipher.doFinal(joined, IV_BYTES, joined.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Che số giấy tờ, chỉ giữ 4 ký tự cuối dạng "********1234" — đây là định dạng hiển thị cho hội viên và trên
     * các màn hình hồ sơ.
     */
    public static String mask(String plain) {
        if (plain == null || plain.isBlank()) return null;
        String last4 = plain.length() <= 4 ? plain : plain.substring(plain.length() - 4);
        return "********" + last4;
    }

    /** Giá trị đã ở dạng che chưa (bắt đầu bằng 8 dấu sao). */
    public static boolean isMasked(String value) {
        return value != null && value.startsWith("********");
    }
}
