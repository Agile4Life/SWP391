package com.swp391.scms;

import com.swp391.scms.common.CenterTime;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * Điểm khởi động của API SÖL (Spring Boot). @EnableScheduling bật các job chạy định kỳ (nhắc gia hạn gói, hết
 * hạn thanh toán...).
 */
@EnableScheduling
@SpringBootApplication
public class ScmsApplication {
    /**
     * Hàm main: đặt múi giờ mặc định là giờ Việt Nam, nạp biến môi trường từ file .env (nếu có) rồi khởi động
     * Spring.
     */
    public static void main(String[] args) {
        CenterTime.useAsDefault();
        loadDotEnv();
        SpringApplication.run(ScmsApplication.class, args);
    }

    /**
     * Đọc file .env ở thư mục hiện tại hoặc thư mục cha và đưa từng cặp KEY=VALUE vào System properties. Biến
     * đã có sẵn trong môi trường thật luôn được ưu tiên (không bị ghi đè). Nếu chưa chọn profile thì mặc định
     * dùng profile "supabase" theo quy định của dự án.
     */
    private static void loadDotEnv() {
        for (Path path : List.of(Paths.get(".env"), Paths.get("../../.env"), Paths.get("../.env"))) {
            if (Files.isRegularFile(path)) {
                try {
                    for (String line : Files.readAllLines(path)) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                        int idx = trimmed.indexOf('=');
                        if (idx > 0) {
                            String key = trimmed.substring(0, idx).trim();
                            String val = trimmed.substring(idx + 1).trim();
                            if (System.getProperty(key) == null && System.getenv(key) == null) {
                                System.setProperty(key, val);
                            }
                        }
                    }
                    break;
                } catch (IOException ignored) {}
            }
        }
        if (System.getProperty("spring.profiles.active") == null && System.getenv("SPRING_PROFILES_ACTIVE") == null) {
            System.setProperty("spring.profiles.active", "supabase");
        }
    }
}
