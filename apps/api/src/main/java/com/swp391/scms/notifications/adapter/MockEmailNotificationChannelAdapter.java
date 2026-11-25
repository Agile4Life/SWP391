package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationChannelAdapter;
import com.swp391.scms.notifications.port.NotificationPayload;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Adapter kênh email: hỗ trợ gửi email qua Resend HTTP API (khi có API key và địa chỉ nhận hợp lệ) và luôn ghi
 * log có cấu trúc (SCRUM-108).
 */
@Component
public class MockEmailNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockEmailNotificationChannelAdapter.class);

    private final UserRepository userRepository;
    private final String apiKey;
    private final String fromAddress;
    private final String webOrigin;
    private final RestClient restClient;

    /** Constructor cho test: không có API key (chỉ ghi log). */
    public MockEmailNotificationChannelAdapter(UserRepository userRepository) {
        this(userRepository, "", "SÖL Fitness <no-reply@scms.bluesymphony.site>", (RestClient) null);
    }

    /** Constructor Spring dùng: đọc API key, người gửi, địa chỉ API và địa chỉ website. */
    @Autowired
    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress,
            @Value("${app.resend.base-url:https://api.resend.com}") String baseUrl,
            @Value("${app.web.origin:https://scms.bluesymphony.site}") String webOrigin) {
        this(userRepository, apiKey, fromAddress, defaultRestClient(baseUrl), webOrigin);
    }

    /** Constructor cho test với RestClient giả. */
    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            String apiKey,
            String fromAddress,
            RestClient restClient) {
        this(userRepository, apiKey, fromAddress, restClient, "https://scms.bluesymphony.site");
    }

    /** Constructor đầy đủ: làm sạch cấu hình và đặt giá trị mặc định. */
    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            String apiKey,
            String fromAddress,
            RestClient restClient,
            String webOrigin) {
        this.userRepository = userRepository;
        this.apiKey = stripQuotes(apiKey);
        String cleanFrom = stripQuotes(fromAddress);
        this.fromAddress = !cleanFrom.isBlank() ? cleanFrom : "SÖL Fitness <no-reply@scms.bluesymphony.site>";
        this.webOrigin = SolEmailTemplateRenderer.resolvePublicOrigin(webOrigin);
        this.restClient = restClient != null ? restClient : defaultRestClient("https://api.resend.com");
    }

    /** Bỏ dấu ngoặc kép/đơn bao quanh giá trị cấu hình. */
    private static String stripQuotes(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() >= 2
                && ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    /** Tạo RestClient gọi Resend với thời gian chờ kết nối 5 giây, đọc 10 giây. */
    private static RestClient defaultRestClient(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl((baseUrl != null && !baseUrl.isBlank()) ? baseUrl.trim() : "https://api.resend.com")
                .build();
    }

    /** Kênh EMAIL. */
    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.EMAIL;
    }

    /**
     * Tìm email và tên người nhận, ghi log mô phỏng; nếu đủ điều kiện thì gửi email HTML qua Resend (lỗi chỉ
     * ghi cảnh báo).
     */
    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        String recipientEmail = payload.recipientEmail();
        String recipientName = null;
        String recipientRole = null;
        if (payload.userId() != null) {
            User user = userRepository.findByIdAndDeletedAtIsNull(payload.userId()).orElse(null);
            if (user != null) {
                recipientName = user.getFullName();
                recipientRole = user.getRole() != null ? user.getRole().getCode() : null;
                if (recipientEmail == null || recipientEmail.isBlank()) {
                    recipientEmail = user.getEmail();
                }
            }
            if (recipientEmail == null || recipientEmail.isBlank()) {
                recipientEmail = "member-" + payload.userId() + "@solfitness.local";
            }
        }
        if (recipientEmail == null || recipientEmail.isBlank()) {
            recipientEmail = "member-default@solfitness.local";
        }

        log.info("[MOCK-EMAIL] Simulated delivery for user {} (type={}, entity={} #{})",
                payload.userId(), payload.type(), payload.relatedEntityType(), payload.relatedEntityId());

        if (!apiKey.isBlank() && isDeliverableEmail(recipientEmail) && shouldSendRealEmail(payload)) {
            NotificationPayload effectivePayload = payload;
            if ((payload.actionPath() == null || payload.actionPath().isBlank())
                    && "schedule_change".equalsIgnoreCase(payload.type())
                    && isCoachRole(recipientRole)) {
                effectivePayload = NotificationPayload.builder()
                        .userId(payload.userId())
                        .recipientEmail(payload.recipientEmail())
                        .title(payload.title())
                        .message(payload.message())
                        .type(payload.type())
                        .relatedEntityType(payload.relatedEntityType())
                        .relatedEntityId(payload.relatedEntityId())
                        .actionPath("/coach/classes")
                        .channels(payload.channels())
                        .timestamp(payload.timestamp())
                        .build();
            }
            String subject = effectivePayload.title() != null && !effectivePayload.title().isBlank()
                    ? effectivePayload.title()
                    : "SÖL Fitness — Thông báo dành cho Hội viên";
            String textBody = effectivePayload.message() != null ? effectivePayload.message() : "";
            String htmlBody = SolEmailTemplateRenderer.renderNotificationHtml(effectivePayload, recipientName, webOrigin);
            try {
                restClient.post()
                        .uri("/emails")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of(
                                "from", fromAddress,
                                "to", List.of(recipientEmail.trim()),
                                "subject", subject,
                                "text", textBody,
                                "html", htmlBody
                        ))
                        .retrieve()
                        .toBodilessEntity();
            } catch (RuntimeException ex) {
                log.warn("[RESEND-EMAIL] Failed to deliver email for user {} (type={}): {}",
                        payload.userId(), payload.type(), ex.getClass().getSimpleName());
            }
        }
    }

    /** Địa chỉ có gửi được thật không (có @, không phải địa chỉ nội bộ .local hay .invalid). */
    private static boolean isDeliverableEmail(String email) {
        return email != null
                && email.contains("@")
                && !email.endsWith("@solfitness.local")
                && !email.endsWith(".invalid");
    }

    /** Kiểm tra mã vai trò có phải HLV (COACH / ROLE_COACH) không. */
    private static boolean isCoachRole(String roleCode) {
        return roleCode != null && ("COACH".equalsIgnoreCase(roleCode) || "ROLE_COACH".equalsIgnoreCase(roleCode));
    }

    /** Chỉ gửi khi có tiêu đề hoặc nội dung. */
    private static boolean shouldSendRealEmail(NotificationPayload payload) {
        return payload.title() != null || payload.message() != null;
    }
}
