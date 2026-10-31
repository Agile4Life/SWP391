package com.swp391.scms.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WebConfigTest {
    private static class Registry extends CorsRegistry {
        Map<String, CorsConfiguration> configurations() { return getCorsConfigurations(); }
    }

    @Test
    void corsOnlyAllowsConfiguredOrigins() {
        Registry registry = new Registry();
        new WebConfig("https://example.test, https://other.test").addCorsMappings(registry);
        CorsConfiguration config = registry.configurations().get("/api/**");
        assertThat(config.checkOrigin("https://example.test")).isEqualTo("https://example.test");
        assertThat(config.checkOrigin("http://localhost:9999")).isNull();
    }
}
