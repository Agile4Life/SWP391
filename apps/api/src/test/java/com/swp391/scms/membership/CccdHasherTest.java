package com.swp391.scms.membership;

import static org.junit.jupiter.api.Assertions.*;

import com.swp391.scms.membership.service.CccdHasher;
import org.junit.jupiter.api.Test;

class CccdHasherTest {
    @Test
    void encryptedDocumentNumberRoundTripsAndNeverContainsThePlainNumber() {
        CccdHasher hasher = new CccdHasher("pepper-for-tests");
        String encrypted = hasher.encrypt("079204001234");
        assertFalse(encrypted.contains("079204001234"));
        assertNotEquals(encrypted, hasher.encrypt("079204001234"));
        assertEquals("079204001234", hasher.decrypt(encrypted));
    }

    @Test
    void decryptFallsBackToNullWhenDataIsMissingOrKeyChanged() {
        String encrypted = new CccdHasher("old-pepper").encrypt("079204001234");
        assertNull(new CccdHasher("new-pepper").decrypt(encrypted));
        assertNull(new CccdHasher("old-pepper").decrypt(null));
        assertNull(new CccdHasher("old-pepper").decrypt("not-base64!"));
    }
}
