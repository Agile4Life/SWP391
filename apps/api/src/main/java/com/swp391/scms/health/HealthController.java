package com.swp391.scms.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/** API kiểm tra tình trạng dịch vụ (/api/v1/health), dùng cho hosting và giám sát; không cần đăng nhập. */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {
    /** GET: trả trạng thái UP, tên dịch vụ và thời điểm hiện tại. */
    @GetMapping
    ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "scms-api", "timestamp", Instant.now().toString()));
    }
}
