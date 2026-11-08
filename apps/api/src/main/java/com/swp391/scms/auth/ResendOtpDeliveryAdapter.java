package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.adapter.SolEmailTemplateRenderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

@Component
@Primary
public class ResendOtpDeliveryAdapter implements OtpDeliveryPort {

    private final String apiKey;
    private final String fromAddress;
    private final String webOrigin;
    private final MessageService messageService;
    private final RestClient restClient;

    public ResendOtpDeliveryAdapter(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress) {
        this(apiKey, fromAddress, "https://api.resend.com", null);
    }

    @Autowired
    public ResendOtpDeliveryAdapter(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress,
            @Value("${app.resend.base-url:https://api.resend.com}") String baseUrl,
            @Autowired(required = false) MessageService messageService) {
        this(apiKey, fromAddress, messageService, defaultRestClient(baseUrl), "https://scms.bluesymphony.site");
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient) {
        this(apiKey, fromAddress, messageService, restClient, "https://scms.bluesymphony.site");
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient,
            String webOrigin) {
        this.apiKey = stripQuotes(apiKey);
        String cleanFrom = stripQuotes(fromAddress);
        this.fromAddress = !cleanFrom.isBlank() ? cleanFrom : "SÖL Fitness <no-reply@scms.bluesymphony.site>";
        this.webOrigin = SolEmailTemplateRenderer.resolvePublicOrigin(webOrigin);
        this.messageService = messageService;
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

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    @Override
    public void send(String destination, String code) {
        if (destination == null || !destination.contains("@")) {
            throw new ServiceUnavailableException("SMS_DELIVERY_DISABLED", "auth.otp.sms_not_supported", null, null);
        }
        if (apiKey.isBlank()) {
            throw new ServiceUnavailableException("OTP_DELIVERY_DISABLED", "auth.otp.delivery_not_configured", null, null);
        }
        String subject = msg("auth.otp.subject");
        String textBody = msg("auth.otp.email_body", code);
        String htmlBody = SolEmailTemplateRenderer.renderOtpHtml(code, subject, textBody, webOrigin);
        try {
            restClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", fromAddress,
                            "to", List.of(destination.trim()),
                            "subject", subject,
                            "text", textBody,
                            "html", htmlBody
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new ServiceUnavailableException("OTP_DELIVERY_FAILED", "auth.otp.delivery_failed", null, ex.getMessage());
        }
    }
}
