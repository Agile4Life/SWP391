package com.swp391.scms.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Bộ kiểm thử cho cấu hình WebConfig (web config). */
class WebConfigTest {
    /** Lớp trợ giúp của test: CorsRegistry cho phép đọc cấu hình CORS đã đăng ký. */
    private static class Registry extends CorsRegistry {
        /** Hàm trợ giúp của test: lấy các cấu hình CORS đã đăng ký. */
        Map<String, CorsConfiguration> configurations() { return getCorsConfigurations(); }
    }

    /** Kiểm thử: CORS chỉ cho phép các origin đã cấu hình. */
    @Test
    void corsOnlyAllowsConfiguredOrigins() {
        Registry registry = new Registry();
        new WebConfig("https://example.test, https://other.test").addCorsMappings(registry);
        CorsConfiguration config = registry.configurations().get("/api/**");
        assertThat(config.checkOrigin("https://example.test")).isEqualTo("https://example.test");
        assertThat(config.checkOrigin("http://localhost:9999")).isNull();
    }
}
