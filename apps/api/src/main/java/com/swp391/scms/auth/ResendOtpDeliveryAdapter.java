package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.auth.otp.delivery", havingValue = "resend")
public class ResendOtpDeliveryAdapter implements OtpDeliveryPort {

    private final String apiKey;
    private final String fromAddress;
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
        this(apiKey, fromAddress, messageService, defaultRestClient(baseUrl));
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.fromAddress = (fromAddress != null && !fromAddress.isBlank()) ? fromAddress.trim() : "SÖL Fitness <no-reply@scms.bluesymphony.site>";
        this.messageService = messageService;
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
        try {
            restClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", fromAddress,
                            "to", List.of(destination.trim()),
                            "subject", msg("auth.otp.subject"),
                            "text", msg("auth.otp.email_body", code)
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new ServiceUnavailableException("OTP_DELIVERY_FAILED", "auth.otp.delivery_failed", null, ex.getMessage());
        }
    }
}
