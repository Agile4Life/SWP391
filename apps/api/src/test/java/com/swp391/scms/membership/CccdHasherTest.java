package com.swp391.scms.membership;

import static org.junit.jupiter.api.Assertions.*;

import com.swp391.scms.membership.service.CccdHasher;
import org.junit.jupiter.api.Test;

/** Bộ kiểm thử cho CccdHasher (cccd hasher). */
class CccdHasherTest {
    /** Kiểm thử: số giấy tờ mã hóa giải mã lại đúng và không bao giờ chứa số gốc. */
    @Test
    void encryptedDocumentNumberRoundTripsAndNeverContainsThePlainNumber() {
        CccdHasher hasher = new CccdHasher("pepper-for-tests");
        String encrypted = hasher.encrypt("079204001234");
        assertFalse(encrypted.contains("079204001234"));
        assertNotEquals(encrypted, hasher.encrypt("079204001234"));
        assertEquals("079204001234", hasher.decrypt(encrypted));
    }

    /** Kiểm thử: giải mã trả null khi thiếu dữ liệu hoặc đổi khóa. */
    @Test
    void decryptFallsBackToNullWhenDataIsMissingOrKeyChanged() {
        String encrypted = new CccdHasher("old-pepper").encrypt("079204001234");
        assertNull(new CccdHasher("new-pepper").decrypt(encrypted));
        assertNull(new CccdHasher("old-pepper").decrypt(null));
        assertNull(new CccdHasher("old-pepper").decrypt("not-base64!"));
    }
}
