package com.swp391.scms.common.i18n;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;
import java.util.Locale;

class MessageBundlesConsistencyTest {

    @Test
    void waitlistNotificationsResolveClassAndReservationWindowInBothLanguages() {
        var source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        for (Locale locale : new Locale[] { Locale.forLanguageTag("vi"), Locale.ENGLISH }) {
            String body = source.getMessage("notifications.waitlist.notified.body_window",
                    new Object[] { "Yoga", 15 }, locale);
            assertTrue(body.contains("Yoga"));
            assertTrue(body.contains("15"));
            assertTrue(!source.getMessage("notifications.waitlist.expired.title", null, locale).isBlank());
            assertTrue(source.getMessage("notifications.waitlist.expired.body", new Object[] { "Yoga" }, locale)
                    .contains("Yoga"));
        }
    }

    private static Set<String> keys(String file) throws Exception {
        Properties p = new Properties();
        try (InputStream in = MessageBundlesConsistencyTest.class.getResourceAsStream("/i18n/" + file)) {
            p.load(new java.io.InputStreamReader(in, java.nio.charset.StandardCharsets.UTF_8));
        }
        return new TreeSet<>(p.stringPropertyNames());
    }

    @Test
    void allBundlesDefineTheSameKeys() throws Exception {
        Set<String> vi = keys("messages_vi.properties");
        assertTrue(vi.size() > 100);
        assertEquals(vi, keys("messages_en.properties"));
        assertEquals(vi, keys("messages.properties"));
    }
}
