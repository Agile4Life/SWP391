package com.swp391.scms.common.i18n;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class MessageBundlesConsistencyTest {

    private static Properties loadBundle(String file) throws Exception {
        Properties p = new Properties();
        try (InputStream in = MessageBundlesConsistencyTest.class.getResourceAsStream("/i18n/" + file)) {
            p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        return p;
    }

    private static Set<String> keys(String file) throws Exception {
        return new TreeSet<>(loadBundle(file).stringPropertyNames());
    }

    private static Set<String> placeholders(String text) {
        Set<String> tokens = new TreeSet<>();
        Matcher matcher = Pattern.compile("\\{\\d+\\}").matcher(text);
        while (matcher.find()) {
            tokens.add(matcher.group());
        }
        return tokens;
    }

    private static List<String> duplicateKeys(String file) throws Exception {
        Set<String> seen = new LinkedHashSet<>();
        List<String> duplicates = new ArrayList<>();
        try (InputStream in = MessageBundlesConsistencyTest.class.getResourceAsStream("/i18n/" + file);
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                if (eq > 0) {
                    String key = trimmed.substring(0, eq).trim();
                    if (!seen.add(key)) {
                        duplicates.add(key);
                    }
                }
            }
        }
        return duplicates;
    }

    @Test
    void allBundlesDefineTheSameKeysAndHaveNoDuplicates() throws Exception {
        Set<String> vi = keys("messages_vi.properties");
        assertTrue(vi.size() > 100);
        assertEquals(vi, keys("messages_en.properties"));
        assertEquals(vi, keys("messages.properties"));

        assertEquals(List.of(), duplicateKeys("messages_vi.properties"), "Duplicate keys in messages_vi.properties");
        assertEquals(List.of(), duplicateKeys("messages_en.properties"), "Duplicate keys in messages_en.properties");
        assertEquals(List.of(), duplicateKeys("messages.properties"), "Duplicate keys in messages.properties");
    }

    @Test
    void allReferencedJavaMessageKeysExistInBundles() throws Exception {
        Set<String> vi = keys("messages_vi.properties");
        Path mainJava = Path.of("src/main/java");
        if (!Files.isDirectory(mainJava)) {
            return;
        }
        Pattern getMessagePattern = Pattern.compile("getMessage\\(\\s*\"([a-z0-9_.-]+)\"\\s*(?:,|\\))");
        Pattern validationPattern = Pattern.compile("message\\s*=\\s*\"\\{([a-z0-9_.-]+)\\}\"");
        Pattern resourceNotFoundPattern = Pattern.compile("new\\s+ResourceNotFoundException\\(\\s*\"(resource\\.[a-z0-9_.-]+)\"");
        Pattern exceptionKeyPattern = Pattern.compile("new\\s+(?:BadRequest|Conflict|Forbidden|Unauthorized|TooManyRequests|ServiceUnavailable)Exception\\(\\s*\"[^\"]+\"\\s*,\\s*\"([a-z0-9_.-]+)\"");
        Set<String> missing = new TreeSet<>();

        try (Stream<Path> paths = Files.walk(mainJava)) {
            for (Path file : paths.filter(p -> p.toString().endsWith(".java")).toList()) {
                String source = Files.readString(file, StandardCharsets.UTF_8);
                for (Pattern pattern : List.of(getMessagePattern, validationPattern, resourceNotFoundPattern, exceptionKeyPattern)) {
                    Matcher matcher = pattern.matcher(source);
                    while (matcher.find()) {
                        String key = matcher.group(1);
                        if (key.contains(".") && !key.endsWith(".") && !vi.contains(key)) {
                            missing.add(key + " (" + file.getFileName() + ")");
                        }
                    }
                }
            }
        }

        assertFalse(!missing.isEmpty(), "Missing i18n keys referenced in Java code: " + missing);
    }

    @Test
    void allBundlesHaveMatchingPlaceholdersAndValidMessageFormatSyntax() throws Exception {
        Properties vi = loadBundle("messages_vi.properties");
        Properties en = loadBundle("messages_en.properties");
        Properties def = loadBundle("messages.properties");

        for (String key : new TreeSet<>(vi.stringPropertyNames())) {
            String viVal = vi.getProperty(key);
            String enVal = en.getProperty(key);
            String defVal = def.getProperty(key);

            Set<String> viPlaceholders = placeholders(viVal);
            assertEquals(viPlaceholders, placeholders(enVal), "Placeholder mismatch between VI and EN for key: " + key);
            assertEquals(viPlaceholders, placeholders(defVal), "Placeholder mismatch between VI and default bundle for key: " + key);

            if (viPlaceholders.contains("{0}")) {
                for (String val : List.of(viVal, enVal, defVal)) {
                    String formatted = java.text.MessageFormat.format(val, "ARG_0", "ARG_1", "ARG_2", "ARG_3");
                    assertTrue(formatted.contains("ARG_0"), "MessageFormat failed to substitute {0} (check single quotes) for key: " + key);
                }
            }
        }
    }
}
