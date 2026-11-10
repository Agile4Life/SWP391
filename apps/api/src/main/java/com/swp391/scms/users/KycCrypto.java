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
 * Encrypts identity numbers (CCCD or passport) at rest with AES-256-GCM. The readable number never sits in the
 * database; the member sees only the masked form, and reviewers decrypt it through the review endpoint.
 */
@Component
public class KycCrypto {
    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public KycCrypto(@Value("${app.kyc.encryption-key:${app.jwt.secret}}") String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

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

    /** The readable number, or null when the value is missing or was not produced by {@link #encrypt}. */
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

    /** "********1234": what the member and the profile screens see. */
    public static String mask(String plain) {
        if (plain == null || plain.isBlank()) return null;
        String last4 = plain.length() <= 4 ? plain : plain.substring(plain.length() - 4);
        return "********" + last4;
    }

    public static boolean isMasked(String value) {
        return value != null && value.startsWith("********");
    }
}
