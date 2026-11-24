package com.swp391.scms.facilities;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;

/** Bộ kiểm thử cho EquipmentFeatureDisabled (equipment feature disabled). */
class EquipmentFeatureDisabledTest {
    @Test
    void equipmentManagementControllerIsNotRegistered() {
        var scanner = new ClassPathScanningCandidateComponentProvider(true);
        assertThat(scanner.findCandidateComponents("com.swp391.scms.facilities").stream()
                .map(bean -> bean.getBeanClassName()))
                .doesNotContain("com.swp391.scms.facilities.EquipmentController");
    }
}
