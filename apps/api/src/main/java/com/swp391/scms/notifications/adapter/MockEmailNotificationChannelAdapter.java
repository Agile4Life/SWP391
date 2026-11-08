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
 * Adapter for email notification dispatching with Resend HTTP API support and structured logging (SCRUM-108).
 */
@Component
public class MockEmailNotificationChannelAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(MockEmailNotificationChannelAdapter.class);

    private final UserRepository userRepository;
    private final String apiKey;
    private final String fromAddress;
    private final String webOrigin;
    private final RestClient restClient;

    public MockEmailNotificationChannelAdapter(UserRepository userRepository) {
        this(userRepository, "", "SÖL Fitness <no-reply@scms.bluesymphony.site>", (RestClient) null);
    }

    @Autowired
    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress,
            @Value("${app.resend.base-url:https://api.resend.com}") String baseUrl,
            @Value("${app.web.origin:https://scms.bluesymphony.site}") String webOrigin) {
        this(userRepository, apiKey, fromAddress, defaultRestClient(baseUrl), webOrigin);
    }

    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            String apiKey,
            String fromAddress,
            RestClient restClient) {
        this(userRepository, apiKey, fromAddress, restClient, "https://scms.bluesymphony.site");
    }

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

    private static RestClient defaultRestClient(String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl((baseUrl != null && !baseUrl.isBlank()) ? baseUrl.trim() : "https://api.resend.com")
                .build();
    }

    @Override
    public NotificationChannel getChannel() {
        return NotificationChannel.EMAIL;
    }

    @Override
    public void send(NotificationPayload payload) {
        if (payload == null) {
            return;
        }

        String recipientEmail = payload.recipientEmail();
        String recipientName = null;
        if (payload.userId() != null) {
            User user = userRepository.findByIdAndDeletedAtIsNull(payload.userId()).orElse(null);
            if (user != null) {
                recipientName = user.getFullName();
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
            String subject = payload.title() != null && !payload.title().isBlank()
                    ? payload.title()
                    : "SÖL Fitness — Thông báo dành cho Hội viên";
            String textBody = payload.message() != null ? payload.message() : "";
            String htmlBody = SolEmailTemplateRenderer.renderNotificationHtml(payload, recipientName, webOrigin);
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

    private static boolean isDeliverableEmail(String email) {
        return email != null
                && email.contains("@")
                && !email.endsWith("@solfitness.local")
                && !email.endsWith(".invalid");
    }

    private static boolean shouldSendRealEmail(NotificationPayload payload) {
        return payload.title() != null || payload.message() != null;
    }
}
