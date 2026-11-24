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
 * Bộ quy định của trung tâm mà Sol AI dựa vào để trả lời, đọc một lần từ ai/sol-knowledge.md. Các con số trong
 * file là chỗ giữ {{...}} được điền từ hằng số trong code (nên câu trả lời luôn khớp hệ thống), và chỉ những
 * mục liên quan tới câu hỏi mới được đưa vào prompt.
 *
 * Quy định trung tâm mà Sol AI dùng để trả lời, đọc một lần từ {@code ai/sol-knowledge.md}. Các con số trong
 * file
 * {@code {{placeholders}}} filled from the code and configuration that enforce them, so the answer cannot
 * lệch khỏi những gì hệ thống thực sự làm. Chỉ các mục mà câu hỏi nhắc tới mới được đưa vào prompt.
 */
@Component
public class AiKnowledgeBase {

    static final String RESOURCE = "ai/sol-knowledge.md";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-zA-Z0-9.]+)}}");
    private static final String KEYWORDS_PREFIX = "Từ khóa:";

    /**
     * Một mục "## " trong file: tiêu đề, từ khóa, có luôn gửi kèm không và nội dung.
     *
     * Một mục "## "; các mục {@code always} được gửi kèm mọi câu hỏi.
     */
    record Section(String title, List<String> keywords, boolean always, String body) {}

    private final List<Section> sections;

    /** Đọc file, bỏ ghi chú biên tập, điền giá trị, tách thành các mục và thêm mục quyền lợi theo hạng gói. */
    public AiKnowledgeBase() {
        Map<String, String> values = values();
        // Ghi chú cho người soạn bị bỏ trước: chúng giải thích cú pháp {{placeholder}} và không được điền.
        String text = read().replaceAll("(?s)<!--.*?-->", "");
        List<Section> parsed = new ArrayList<>(parse(fill(text, values)));
        parsed.add(tierBenefits());
        this.sections = List.copyOf(parsed);
    }

    /**
     * Các mục cho câu hỏi: mục luôn gửi kèm cộng các mục có từ khóa xuất hiện trong câu hỏi; không mục nào khớp
     * thì gửi tất cả.
     *
     * Các mục cho câu hỏi này: những mục có từ khóa mà câu hỏi nhắc tới cộng các mục luôn bật, hoặc tất cả
     * khi không mục nào khớp.
     */
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

    /** Danh sách các mục (dùng cho test). */
    List<Section> sections() {
        return sections;
    }

    /** Giá trị điền vào các chỗ giữ: số ngày dùng thử, thời gian sống QR, giờ tự check-out, quy định bảo lưu... */
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

    /** Đọc nội dung file kiến thức trong resources; thiếu file thì dừng khởi động. */
    private static String read() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Missing " + RESOURCE, e);
        }
    }

    /**
     * Điền các chỗ giữ {{tên}}; gặp tên lạ thì dừng khởi động để lỗi gõ không bao giờ tới tay hội viên.
     *
     * Lỗi ngay lúc khởi động khi gặp placeholder lạ, để lỗi gõ không bao giờ đến hội viên dưới dạng
     * "{{...}}".
     */
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

    /** Tách văn bản thành các mục theo tiêu đề "## ", đọc dòng "Từ khóa:" (dấu * nghĩa là luôn gửi kèm). */
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

    /**
     * Mục quyền lợi theo hạng gói (Silver/Gold/Platinum và gói trải nghiệm) dựng từ PackageBenefits, để AI nói
     * đúng điều mà hệ thống áp dụng.
     *
     * Được dựng từ {@link PackageBenefits} để AI trích dẫn đúng những gì việc đặt chỗ, tạm hoãn và giảm giá
     * thực thi.
     */
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

    /** Tạo gói tạm theo hạng và số ngày để hỏi PackageBenefits. */
    private static MembershipPackage pkg(String tier, int days) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName(tier != null ? tier : "");
        pkg.setTier(tier);
        pkg.setDurationDays(days);
        return pkg;
    }

    /** Diễn đạt số ngày bảo lưu tối đa ("tối đa N ngày" hoặc "không bảo lưu được"). */
    private static String holdText(int days) {
        return days > 0 ? "tối đa " + days + " ngày" : "không bảo lưu được";
    }
}
