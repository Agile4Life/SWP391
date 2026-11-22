package com.swp391.scms.ai.service;

import com.swp391.scms.shop.ShopProperties;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiKnowledgeBaseTest {

    private final AiKnowledgeBase base = new AiKnowledgeBase();

    @Test
    void everyPlaceholderInTheBundledFileIsFilled() {
        base.sections().forEach(section -> {
            assertFalse(section.body().contains("{{"), section.title());
            assertFalse(section.keywords().isEmpty() && !section.always(), section.title());
        });
    }

    @Test
    void numbersComeFromTheCodeAndConfigurationThatEnforceThem() {
        ShopProperties shop = new ShopProperties();
        shop.setPaymentWindowMinutes(45);
        shop.setCounterHoldHours(12);
        String all = new AiKnowledgeBase(shop, 20, 90).sectionsFor("");

        assertTrue(all.contains("ít nhất 24 giờ; mỗi lần tối thiểu 3 ngày"));
    }

    @Test
    void tierBenefitsMatchPackageBenefits() {
        String tiers = base.sectionsFor("gói gold khác platinum thế nào");

        assertTrue(tiers.contains("- Platinum: PT 1:1 miễn phí 6 buổi"));
        assertTrue(tiers.contains("PT 1:1 miễn phí 6 buổi"));
        assertTrue(tiers.contains("bảo lưu: tối đa 30 ngày (gói 1 tháng cũ: tối đa 7 ngày)"));
        assertTrue(tiers.contains("- Silver:") && tiers.contains("bảo lưu: tối đa 7 ngày (gói 1 tháng cũ: không bảo lưu được)"));
        assertTrue(tiers.contains("giảm 20%"));
        assertFalse(tiers.contains("khóa học nhóm miễn phí") || tiers.contains("đặt sân miễn phí") || tiers.contains("khóa học có phí và sản phẩm"));
    }

    @Test
    void sendsOnlyTheSectionsTheQuestionIsAboutPlusTheIntroduction() {
        String aboutHold = base.sectionsFor("Mình muốn bảo lưu gói 2 tuần được không?");

        assertTrue(aboutHold.contains("Bảo lưu gói tập:"));
        assertTrue(aboutHold.contains("Giới thiệu:"));
        assertFalse(aboutHold.contains("Ví SÖL:"));
        assertFalse(aboutHold.contains("Check-in và check-out:"));
    }

    @Test
    void sendsEverythingWhenNoSectionMatches() {
        String general = base.sectionsFor("Xin chào");

        base.sections().forEach(section -> assertTrue(general.contains(section.title() + ":\n"), section.title()));
    }

    @Test
    void unknownPlaceholderFailsInsteadOfReachingTheMember() {
        assertThrows(IllegalStateException.class, () -> AiKnowledgeBase.fill("Giá {{court.typo}}", Map.of()));
    }
}
