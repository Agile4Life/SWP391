package com.swp391.scms.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

/** Bộ kiểm thử cho ClassFeatureDisabled (class feature disabled). */
class ClassFeatureDisabledTest {
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
}
