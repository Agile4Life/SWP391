package com.swp391.scms.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class PasswordPolicyTest {
    private static final Pattern POLICY = Pattern.compile(PasswordPolicy.REGEX);

    @Test
    void acceptsEightToFiftyCharactersWithALetterAndADigit() {
        assertTrue(POLICY.matcher("Demo@12345").matches());
        assertTrue(POLICY.matcher("abcdefg1").matches());
    }

    @Test
    void rejectsShortAllLettersAllDigitsSpacesAndTooLong() {
        assertFalse(POLICY.matcher("abc123").matches());
        assertFalse(POLICY.matcher("abcdefgh").matches());
        assertFalse(POLICY.matcher("12345678").matches());
        assertFalse(POLICY.matcher("abcd 1234").matches());
        assertFalse(POLICY.matcher("a1".repeat(26)).matches());
    }
}
