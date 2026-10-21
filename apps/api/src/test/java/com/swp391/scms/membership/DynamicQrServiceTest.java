package com.swp391.scms.membership;

import com.swp391.scms.membership.service.DynamicQrService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DynamicQrServiceTest {

    @Test
    void springBeanUsesConfiguredSigningSecretAndLifetime() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("qr-test", Map.of(
                    "app.qr.secret", SECRET, "app.qr.ttl-seconds", "5")));
            context.register(DynamicQrService.class);
            context.refresh();
            DynamicQrService managed = context.getBean(DynamicQrService.class);
            long now = 1_000_000L;
            String signed = new DynamicQrService(SECRET, 5).generate(10L, 5L, now);
            assertTrue(managed.verify(signed, now).valid());
            assertTrue(managed.verify(signed, now + 5_001).expired());
            String foreign = new DynamicQrService("another-deployment-secret", 60).generate(10L, 5L, now);
            assertFalse(managed.verify(foreign, now).valid());
        }
    }

    private DynamicQrService qrService;
    private static final String SECRET = "test-secret-key-for-hmac-sha256-scms-project";
    private static final long TTL_SECONDS = 60;

    @BeforeEach
    void setUp() {
        qrService = new DynamicQrService(SECRET, TTL_SECONDS);
    }

    @Test
    @DisplayName("Sinh và xác thực Dynamic QR hợp lệ thành công")
    void validDynamicQr_verifiesSuccessfully() {
        long now = System.currentTimeMillis();
        String qr = qrService.generate(10L, 5L, now);

        assertTrue(qrService.isDynamic(qr));
        assertTrue(qr.startsWith("DYN:10:5:" + now + ":"));

        DynamicQrService.VerificationResult result = qrService.verify(qr, now + 10000L); // 10s sau
        assertTrue(result.valid());
        assertFalse(result.expired());
        assertTrue(result.isDynamic());
        assertEquals(10L, result.userId());
        assertEquals(5L, result.subscriptionId());
    }

    @Test
    @DisplayName("Dynamic QR bị sửa đổi chữ ký hoặc dữ liệu -> Bị từ chối (invalid, không phải expired)")
    void tamperedDynamicQr_rejected() {
        long now = System.currentTimeMillis();
        String qr = qrService.generate(10L, 5L, now);
        String tampered = qr.substring(0, qr.length() - 4) + "ffff";

        DynamicQrService.VerificationResult result = qrService.verify(tampered, now + 5000L);
        assertFalse(result.valid());
        assertFalse(result.expired());
    }

    @Test
    @DisplayName("Dynamic QR quá thời hạn sống (TTL > 60s) -> Bị từ chối với cờ expired = true")
    void expiredDynamicQr_flaggedAsExpired() {
        long generatedAt = System.currentTimeMillis() - 75000L; // 75s trước
        String qr = qrService.generate(10L, 5L, generatedAt);

        DynamicQrService.VerificationResult result = qrService.verify(qr, System.currentTimeMillis());
        assertFalse(result.valid());
        assertTrue(result.expired());
    }

    @Test
    @DisplayName("Mã QR tĩnh không bắt đầu bằng DYN -> isDynamic = false")
    void staticQr_recognizedAsNotDynamic() {
        assertFalse(qrService.isDynamic("SUB-10-ABCD1234"));
        DynamicQrService.VerificationResult result = qrService.verify("SUB-10-ABCD1234", System.currentTimeMillis());
        assertFalse(result.isDynamic());
        assertFalse(result.valid());
    }
}
