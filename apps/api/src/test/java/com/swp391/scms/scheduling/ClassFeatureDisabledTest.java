package com.swp391.scms.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

/** Bộ kiểm thử cho ClassFeatureDisabled (class feature disabled). */
class ClassFeatureDisabledTest {
    /** Kiểm thử: các endpoint lớp học và seeder lớp mẫu không được đăng ký khi tính năng đã tắt. */
    @Test
    void classEndpointsAndDemoSeederAreNotRegistered() {
        var scanner = new ClassPathScanningCandidateComponentProvider(true);
        var environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("demo-test",
                java.util.Map.of("app.demo.seed-enabled", "true")));
        scanner.setEnvironment(environment);
        assertThat(scanner.findCandidateComponents("com.swp391.scms").stream()
                .map(bean -> bean.getBeanClassName()))
                .doesNotContain(
                        "com.swp391.scms.scheduling.ClassController",
                        "com.swp391.scms.scheduling.ClassSessionController",
                        "com.swp391.scms.scheduling.EnrollmentController",
                        "com.swp391.scms.scheduling.SessionBookingController",
                        "com.swp391.scms.attendance.SessionAttendanceController",
                        "com.swp391.scms.demo.DemoClassSeeder");
    }

    /** Kiểm thử: khi bật app.legacy.classes-enabled=true thì các controller lớp nhóm và điểm danh được đăng ký đầy đủ. */
    @Test
    void classEndpointsAreRegisteredWhenFeatureEnabled() {
        var scanner = new ClassPathScanningCandidateComponentProvider(true);
        var environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("classes-enabled-test",
                java.util.Map.of("app.legacy.classes-enabled", "true")));
        scanner.setEnvironment(environment);
        assertThat(scanner.findCandidateComponents("com.swp391.scms").stream()
                .map(bean -> bean.getBeanClassName()))
                .contains(
                        "com.swp391.scms.scheduling.ClassController",
                        "com.swp391.scms.scheduling.ClassSessionController",
                        "com.swp391.scms.scheduling.EnrollmentController",
                        "com.swp391.scms.scheduling.SessionBookingController",
                        "com.swp391.scms.attendance.SessionAttendanceController");
    }
}
