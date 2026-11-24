package com.swp391.scms.courts;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;

/** Bộ kiểm thử cho CourtFeatureDisabled (court feature disabled). */
class CourtFeatureDisabledTest {
    /** Kiểm thử: các endpoint sân và seeder không được đăng ký khi tính năng đã tắt. */
    @Test
    void courtEndpointsAndSeederAreNotRegistered() {
        var scanner = new ClassPathScanningCandidateComponentProvider(true);
        Set<String> components = scanner.findCandidateComponents("com.swp391.scms.courts").stream()
                .map(bean -> bean.getBeanClassName()).collect(Collectors.toSet());
        assertThat(components).doesNotContain(
                "com.swp391.scms.courts.controller.CourtBookingController",
                "com.swp391.scms.courts.CourtSeeder");
    }
}
