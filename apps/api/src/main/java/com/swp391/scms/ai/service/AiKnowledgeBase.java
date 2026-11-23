package com.swp391.scms.ai.service;

import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.service.DynamicQrService;
import com.swp391.scms.membership.service.EntitlementRevocationService;
import com.swp391.scms.membership.service.MemberTrialService;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Centre rules Sol AI answers from, read once from {@code ai/sol-knowledge.md}. Numbers in the file are
 * {@code {{placeholders}}} filled from the code and configuration that enforce them, so the answer cannot
 * drift from what the system actually does. Only the sections a question is about go into the prompt.
 */
@Component
public class AiKnowledgeBase {

    static final String RESOURCE = "ai/sol-knowledge.md";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-zA-Z0-9.]+)}}");
    private static final String KEYWORDS_PREFIX = "Từ khóa:";

    /** One "## " section; {@code always} sections are sent with every question. */
    record Section(String title, List<String> keywords, boolean always, String body) {}

    private final List<Section> sections;

    public AiKnowledgeBase() {
        Map<String, String> values = values();
        // Editor notes are dropped first: they explain the {{placeholder}} syntax and must not be filled.
        String text = read().replaceAll("(?s)<!--.*?-->", "");
        List<Section> parsed = new ArrayList<>(parse(fill(text, values)));
        parsed.add(tierBenefits());
        this.sections = List.copyOf(parsed);
    }

    /** The sections for this question: those whose keywords it mentions plus the always-on ones, or all when none match. */
    public String sectionsFor(String query) {
        String normalized = AiRagContextService.normalize(query);
        List<Section> matched = sections.stream()
                .filter(section -> !section.always() && section.keywords().stream()
                        .anyMatch(keyword -> (" " + normalized + " ").contains(" " + keyword + " ")))
                .toList();
        StringBuilder sb = new StringBuilder();
        for (Section section : sections) {
            if (section.always() || matched.isEmpty() || matched.contains(section)) {
                sb.append("\n").append(section.title()).append(":\n").append(section.body()).append("\n");
            }
        }
        return sb.toString();
    }

    List<Section> sections() {
        return sections;
    }

    private static Map<String, String> values() {
        Map<String, String> v = new HashMap<>();
        v.put("trial.days", String.valueOf(MemberTrialService.TRIAL_DAYS));
        v.put("checkin.qrTtlSeconds", String.valueOf(DynamicQrService.DEFAULT_TTL_SECONDS));
        v.put("checkin.autoCheckoutHours", String.valueOf(CenterCheckinService.ANTI_PASSBACK_TIMEOUT_HOURS));
        v.put("hold.noticeHours", String.valueOf(MembershipSubscriptionService.HOLD_NOTICE_HOURS));
        v.put("hold.minDays", String.valueOf(MembershipSubscriptionService.MIN_HOLD_DAYS));
        v.put("hold.ptRefundDays", String.valueOf(EntitlementRevocationService.PT_HOLD_REFUND_DAYS));
        v.put("hold.maxDocuments", String.valueOf(MembershipSubscriptionService.MAX_HOLD_DOCUMENTS));
        v.put("hold.maxDocumentMb", String.valueOf(MembershipSubscriptionService.MAX_HOLD_DOCUMENT_BYTES / (1024 * 1024)));
        return v;
    }

    private static String read() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Missing " + RESOURCE, e);
        }
    }

    /** Fails at startup on an unknown placeholder, so a typo never reaches a member as "{{...}}". */
    static String fill(String text, Map<String, String> values) {
        Matcher m = PLACEHOLDER.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String value = values.get(m.group(1));
            if (value == null) {
                throw new IllegalStateException("Unknown placeholder {{" + m.group(1) + "}} in " + RESOURCE);
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    static List<Section> parse(String text) {
        List<Section> result = new ArrayList<>();
        for (String chunk : text.split("(?m)^## ")) {
            int newline = chunk.indexOf('\n');
            if (newline < 0 || chunk.startsWith("#")) {
                continue; // the file title, before the first section
            }
            String title = chunk.substring(0, newline).trim();
            List<String> keywords = new ArrayList<>();
            boolean always = false;
            StringBuilder body = new StringBuilder();
            for (String line : chunk.substring(newline + 1).split("\n")) {
                if (line.startsWith(KEYWORDS_PREFIX)) {
                    String list = line.substring(KEYWORDS_PREFIX.length()).trim();
                    always = "*".equals(list);
                    for (String keyword : list.split(",")) {
                        String k = AiRagContextService.normalize(keyword);
                        if (!k.isEmpty()) keywords.add(k);
                    }
                } else if (!line.isBlank()) {
                    body.append(line.trim()).append("\n");
                }
            }
            if (!title.isEmpty() && !body.isEmpty()) {
                result.add(new Section(title, List.copyOf(keywords), always, body.toString().trim()));
            }
        }
        return result;
    }

    /** Built from {@link PackageBenefits} so the AI quotes exactly what booking, holds and discounts enforce. */
    private static Section tierBenefits() {
        StringBuilder sb = new StringBuilder();
        for (String tier : List.of("SILVER", "GOLD", "PLATINUM")) {
            MembershipPackage month = pkg(tier, 30);
            MembershipPackage longTerm = pkg(tier, 90);
            sb.append("- ").append(tier.charAt(0)).append(tier.substring(1).toLowerCase(java.util.Locale.ROOT)).append(": ")
                    .append("PT 1:1 miễn phí ").append(PackageBenefits.ptSessionsPerCycle(month)).append(" buổi mỗi 30 ngày; ")
                    .append("bảo lưu: ").append(holdText(PackageBenefits.holdMaxDays(longTerm)))
                    .append(" (gói 1 tháng cũ: ").append(holdText(PackageBenefits.holdMaxDays(month))).append("); ")
                    .append("giảm ").append(PackageBenefits.discountPercent(month)).append("% cho buổi PT thêm");
            sb.append(".\n");
        }
        MembershipPackage trial = pkg(null, PackageBenefits.TRIAL_MAX_DAYS);
        trial.setName("Trải nghiệm");
        sb.append("- Gói trải nghiệm: dịch vụ như hạng Gold, PT 1:1 miễn phí ").append(PackageBenefits.ptSessionsPerCycle(trial))
                .append(" buổi, không bảo lưu được.");
        return new Section("Quyền lợi theo hạng gói",
                List.of("quyen loi", "hang", "silver", "gold", "platinum", "vip", "giam gia", "uu dai", "pt", "khac nhau",
                        "so sanh", "nen chon", "goi nao", "bao luu"),
                false, sb.toString());
    }

    private static MembershipPackage pkg(String tier, int days) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName(tier != null ? tier : "");
        pkg.setTier(tier);
        pkg.setDurationDays(days);
        return pkg;
    }

    private static String holdText(int days) {
        return days > 0 ? "tối đa " + days + " ngày" : "không bảo lưu được";
    }
}
