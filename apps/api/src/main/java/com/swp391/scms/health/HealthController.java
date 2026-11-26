package com.swp391.scms.health;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;

/**
 * API kiểm tra tình trạng sẵn sàng dịch vụ (/api/v1/health), dùng cho Docker/hosting và giám sát; không cần
 * đăng nhập. Chỉ trả 200 UP sau khi Spring Boot đã sẵn sàng nhận traffic (ApplicationReady) và kết nối CSDL
 * hoạt động bình thường.
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {
    private static final int DB_VALID_TIMEOUT_SECONDS = 2;

    private final ApplicationAvailability availability;
    private final DataSource dataSource;

    @Autowired
    public HealthController(ObjectProvider<ApplicationAvailability> availabilityProvider,
                            ObjectProvider<DataSource> dataSourceProvider) {
        this(availabilityProvider.getIfAvailable(), dataSourceProvider.getIfAvailable());
    }

    public HealthController() {
        this((ApplicationAvailability) null, null);
    }

    HealthController(ApplicationAvailability availability, DataSource dataSource) {
        this.availability = availability;
        this.dataSource = dataSource;
    }

    /** GET: trả 200 UP khi ứng dụng và CSDL đã sẵn sàng; trả 503 STARTING/DOWN khi đang khởi động hoặc lỗi CSDL. */
    @GetMapping
    ResponseEntity<Map<String, Object>> health() {
        String now = Instant.now().toString();
        if (availability != null && availability.getReadinessState() != ReadinessState.ACCEPTING_TRAFFIC) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "STARTING", "service", "scms-api", "timestamp", now));
        }
        if (dataSource != null && !isDatabaseReachable()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "DOWN", "service", "scms-api", "timestamp", now));
        }
        return ResponseEntity.ok(Map.of("status", "UP", "service", "scms-api", "timestamp", now));
    }

    private boolean isDatabaseReachable() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(DB_VALID_TIMEOUT_SECONDS);
        } catch (SQLException ex) {
            return false;
        }
    }
}
