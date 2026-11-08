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
    private final RestClient restClient;

    public MockEmailNotificationChannelAdapter(UserRepository userRepository) {
        this(userRepository, "", "SÖL Fitness <no-reply@scms.bluesymphony.site>", (RestClient) null);
    }

    @Autowired
    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress,
            @Value("${app.resend.base-url:https://api.resend.com}") String baseUrl) {
        this(userRepository, apiKey, fromAddress, defaultRestClient(baseUrl));
    }

    public MockEmailNotificationChannelAdapter(
            UserRepository userRepository,
            String apiKey,
            String fromAddress,
            RestClient restClient) {
        this.userRepository = userRepository;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.fromAddress = (fromAddress != null && !fromAddress.isBlank()) ? fromAddress.trim() : "SÖL Fitness <no-reply@scms.bluesymphony.site>";
        this.restClient = restClient != null ? restClient : defaultRestClient("https://api.resend.com");
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
        if ((recipientEmail == null || recipientEmail.isBlank()) && payload.userId() != null) {
            recipientEmail = userRepository.findByIdAndDeletedAtIsNull(payload.userId())
                    .map(User::getEmail)
                    .orElse("member-" + payload.userId() + "@solfitness.local");
        }
        if (recipientEmail == null || recipientEmail.isBlank()) {
            recipientEmail = "member-default@solfitness.local";
        }

        log.info("[MOCK-EMAIL] Simulated delivery for user {} (type={}, entity={} #{})",
                payload.userId(), payload.type(), payload.relatedEntityType(), payload.relatedEntityId());

        if (!apiKey.isBlank() && isDeliverableEmail(recipientEmail) && shouldSendRealEmail(payload)) {
            restClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", fromAddress,
                            "to", List.of(recipientEmail.trim()),
                            "subject", payload.title() != null ? payload.title() : "SÖL Fitness",
                            "text", payload.message() != null ? payload.message() : ""
                    ))
                    .retrieve()
                    .toBodilessEntity();
        }
    }

    private static boolean isDeliverableEmail(String email) {
        return email != null
                && email.contains("@")
                && !email.endsWith("@solfitness.local")
                && !email.endsWith(".invalid");
    }

    private static boolean shouldSendRealEmail(NotificationPayload payload) {
        return "wallet".equalsIgnoreCase(payload.relatedEntityType())
                || "password_changed".equalsIgnoreCase(payload.type())
                || "payment".equalsIgnoreCase(payload.type());
    }
}
