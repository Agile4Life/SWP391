package com.swp391.scms.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;
import java.io.IOException;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** Bộ kiểm thử cho AiChatConfiguration (ai chat configuration). */
class AiChatConfigurationTest {
    /** Hàm trợ giúp của test: tạo Environment giả với các thuộc tính cho trước. */
    private MockEnvironment environment(Map<String, Object> variables) throws IOException {
        var environment = new MockEnvironment();
        // Chỉ dùng môi trường giả lập: không khởi chạy ứng dụng Spring, secret thật hay cơ sở dữ liệu.
        environment.getPropertySources().addFirst(new MapPropertySource("test-variables", variables));
        for (var source : new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))) {
            environment.getPropertySources().addLast(source);
        }
        return environment;
    }

    @Test void defaultsAreDisabledAndEmpty() throws IOException {
        var env = environment(Map.of());
        assertEquals("disabled", env.getProperty("scms.ai.chat.provider"));
        assertEquals("", env.getProperty("scms.ai.chat.api-key"));
        assertEquals("", env.getProperty("scms.ai.chat.model"));
    }

    @Test void legacyVariablesAreAccepted() throws IOException {
        var env = environment(Map.of("SCMS_AI_PROVIDER", "gemini", "SCMS_AI_API_KEY", "unit-key", "SCMS_AI_MODEL", "unit-model"));
        assertEquals("gemini", env.getProperty("scms.ai.chat.provider"));
        assertEquals("unit-key", env.getProperty("scms.ai.chat.api-key"));
        assertEquals("unit-model", env.getProperty("scms.ai.chat.model"));
    }

    @Test void chatVariablesOverrideLegacyVariables() throws IOException {
        var env = environment(Map.of("SCMS_AI_PROVIDER", "gemini", "SCMS_AI_API_KEY", "legacy-key", "SCMS_AI_MODEL", "legacy-model",
                "SCMS_AI_CHAT_PROVIDER", "openai", "SCMS_AI_CHAT_API_KEY", "chat-key", "SCMS_AI_CHAT_MODEL", "chat-model"));
        assertEquals("openai", env.getProperty("scms.ai.chat.provider"));
        assertEquals("chat-key", env.getProperty("scms.ai.chat.api-key"));
        assertEquals("chat-model", env.getProperty("scms.ai.chat.model"));
    }
}
