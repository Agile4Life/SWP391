package com.swp391.scms.ai.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Bộ kiểm thử cho AiKnowledgeBase (ai knowledge base). */
class AiKnowledgeBaseTest {

    private final AiKnowledgeBase base = new AiKnowledgeBase();

    /** Kiểm thử: mọi placeholder trong file kiến thức đi kèm đều được điền. */
    @Test
    void everyPlaceholderInTheBundledFileIsFilled() {
        base.sections().forEach(section -> {
            assertFalse(section.body().contains("{{"), section.title());
            assertFalse(section.keywords().isEmpty() && !section.always(), section.title());
        });
    }

    /** Kiểm thử: các con số lấy từ chính code áp dụng quy tắc đó. */
    @Test
    void numbersComeFromTheCodeThatEnforcesThem() {
        String all = base.sectionsFor("");

        assertTrue(all.contains("ít nhất 24 giờ; mỗi lần tối thiểu 3 ngày"));
    }

    /** Kiểm thử: quyền lợi theo hạng khớp với quyền lợi của gói tập. */
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

    /** Kiểm thử: chỉ gửi các mục liên quan đến câu hỏi cộng phần giới thiệu. */
    @Test
    void sendsOnlyTheSectionsTheQuestionIsAboutPlusTheIntroduction() {
        String aboutHold = base.sectionsFor("Mình muốn bảo lưu gói 2 tuần được không?");

        assertTrue(aboutHold.contains("Bảo lưu gói tập:"));
        assertTrue(aboutHold.contains("Giới thiệu:"));
        assertFalse(aboutHold.contains("Ví SÖL:"));
        assertFalse(aboutHold.contains("Check-in và check-out:"));
    }

    /** Kiểm thử: gửi toàn bộ khi không có mục nào khớp. */
    @Test
    void sendsEverythingWhenNoSectionMatches() {
        String general = base.sectionsFor("Xin chào");

        base.sections().forEach(section -> assertTrue(general.contains(section.title() + ":\n"), section.title()));
    }

    /** Kiểm thử: placeholder lạ làm lỗi thay vì lọt tới hội viên. */
    @Test
    void unknownPlaceholderFailsInsteadOfReachingTheMember() {
        assertThrows(IllegalStateException.class, () -> AiKnowledgeBase.fill("Giá {{court.typo}}", Map.of()));
    }
}
