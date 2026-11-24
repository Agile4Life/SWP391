package com.swp391.scms.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import com.swp391.scms.common.CenterTime;
import java.time.Clock;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Cấu hình web: CORS cho các domain frontend được phép gọi API và Clock theo giờ trung tâm. */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String[] allowedOrigins;

    /** Đọc danh sách domain được phép (CORS) từ cấu hình app.cors.allowed-origins, phân tách bằng dấu phẩy. */
    public WebConfig(@Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000}") String allowedOrigins) {
        this.allowedOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim).filter(origin -> !origin.isEmpty()).toArray(String[]::new);
    }

    /**
     * Đồng hồ hệ thống theo giờ Việt Nam; service nhận Clock qua constructor để test có thể "đóng băng" thời
     * gian.
     */
    @Bean
    public Clock clock() { return Clock.system(CenterTime.ZONE); }

    /**
     * Cho phép frontend ở các domain đã cấu hình gọi /api/** với các phương thức GET, POST, PUT, PATCH, DELETE,
     * OPTIONS.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
