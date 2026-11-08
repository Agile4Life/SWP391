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

import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
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
    private final String smtpHost;
    private final int smtpPort;
    private final String smtpUsername;
    private final String smtpPassword;
    private final String smtpFrom;

    public ResendOtpDeliveryAdapter(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress) {
        this(apiKey, fromAddress, "https://api.resend.com", null);
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            String baseUrl,
            MessageService messageService) {
        this(apiKey, fromAddress, messageService, defaultRestClient(baseUrl), "https://scms.bluesymphony.site", "", 587, "", "", "");
    }

    @Autowired
    public ResendOtpDeliveryAdapter(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-address:${app.auth.otp.from-address:SÖL Fitness <no-reply@scms.bluesymphony.site>}}") String fromAddress,
            @Value("${app.resend.base-url:https://api.resend.com}") String baseUrl,
            @Autowired(required = false) MessageService messageService,
            @Value("${SMTP_HOST:}") String smtpHost,
            @Value("${SMTP_PORT:587}") int smtpPort,
            @Value("${SMTP_USERNAME:}") String smtpUsername,
            @Value("${SMTP_PASSWORD:}") String smtpPassword,
            @Value("${SMTP_FROM:}") String smtpFrom) {
        this(apiKey, fromAddress, messageService, defaultRestClient(baseUrl), "https://scms.bluesymphony.site",
                smtpHost, smtpPort, smtpUsername, smtpPassword, smtpFrom);
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient) {
        this(apiKey, fromAddress, messageService, restClient, "https://scms.bluesymphony.site", "", 587, "", "", "");
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient,
            String webOrigin) {
        this(apiKey, fromAddress, messageService, restClient, webOrigin, "", 587, "", "", "");
    }

    public ResendOtpDeliveryAdapter(
            String apiKey,
            String fromAddress,
            MessageService messageService,
            RestClient restClient,
            String webOrigin,
            String smtpHost,
            int smtpPort,
            String smtpUsername,
            String smtpPassword,
            String smtpFrom) {
        this.apiKey = stripQuotes(apiKey);
        String cleanFrom = stripQuotes(fromAddress);
        this.fromAddress = !cleanFrom.isBlank() ? cleanFrom : "SÖL Fitness <no-reply@scms.bluesymphony.site>";
        this.webOrigin = SolEmailTemplateRenderer.resolvePublicOrigin(webOrigin);
        this.messageService = messageService;
        this.restClient = restClient != null ? restClient : defaultRestClient("https://api.resend.com");
        this.smtpHost = stripQuotes(smtpHost);
        this.smtpPort = smtpPort > 0 ? smtpPort : 587;
        this.smtpUsername = stripQuotes(smtpUsername);
        this.smtpPassword = stripQuotes(smtpPassword);
        String cleanSmtpFrom = stripQuotes(smtpFrom);
        this.smtpFrom = !cleanSmtpFrom.isBlank() ? cleanSmtpFrom : this.smtpUsername;
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
        boolean hasResend = !apiKey.isBlank();
        boolean hasSmtp = !smtpHost.isBlank() && !smtpUsername.isBlank() && !smtpPassword.isBlank();
        if (!hasResend && !hasSmtp) {
            throw new ServiceUnavailableException("OTP_DELIVERY_DISABLED", "auth.otp.delivery_not_configured", null, null);
        }
        String subject = msg("auth.otp.subject");
        String textBody = msg("auth.otp.email_body", code);
        String htmlBody = SolEmailTemplateRenderer.renderOtpHtml(code, subject, textBody, webOrigin);
        if (hasResend) {
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
                return;
            } catch (RestClientException ex) {
                if (!hasSmtp) {
                    throw new ServiceUnavailableException("OTP_DELIVERY_FAILED", "auth.otp.delivery_failed", null, ex.getMessage());
                }
            }
        }
        sendViaStartTlsSmtp(destination.trim(), subject, htmlBody);
    }

    private void sendViaStartTlsSmtp(String recipient, String subject, String htmlBody) {
        try (Socket plainSocket = new Socket()) {
            plainSocket.connect(new InetSocketAddress(smtpHost, smtpPort), 5_000);
            plainSocket.setSoTimeout(10_000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(plainSocket.getInputStream(), StandardCharsets.UTF_8));
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(plainSocket.getOutputStream(), StandardCharsets.UTF_8));

            expectSmtpCode(reader, 220);
            sendSmtpLine(writer, "EHLO localhost");
            expectSmtpCode(reader, 250);
            sendSmtpLine(writer, "STARTTLS");
            expectSmtpCode(reader, 220);

            SSLSocketFactory sslFactory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            try (SSLSocket tlsSocket = (SSLSocket) sslFactory.createSocket(plainSocket, smtpHost, smtpPort, true)) {
                tlsSocket.setSoTimeout(10_000);
                SSLParameters sslParams = tlsSocket.getSSLParameters();
                sslParams.setEndpointIdentificationAlgorithm("HTTPS");
                tlsSocket.setSSLParameters(sslParams);
                tlsSocket.startHandshake();

                BufferedReader tlsReader = new BufferedReader(new InputStreamReader(tlsSocket.getInputStream(), StandardCharsets.UTF_8));
                BufferedWriter tlsWriter = new BufferedWriter(new OutputStreamWriter(tlsSocket.getOutputStream(), StandardCharsets.UTF_8));

                sendSmtpLine(tlsWriter, "EHLO localhost");
                expectSmtpCode(tlsReader, 250);

                sendSmtpLine(tlsWriter, "AUTH LOGIN");
                expectSmtpCode(tlsReader, 334);
                sendSmtpLine(tlsWriter, Base64.getEncoder().encodeToString(smtpUsername.getBytes(StandardCharsets.UTF_8)));
                expectSmtpCode(tlsReader, 334);
                sendSmtpLine(tlsWriter, Base64.getEncoder().encodeToString(smtpPassword.getBytes(StandardCharsets.UTF_8)));
                expectSmtpCode(tlsReader, 235);

                sendSmtpLine(tlsWriter, "MAIL FROM:<" + smtpFrom + ">");
                expectSmtpCode(tlsReader, 250);
                sendSmtpLine(tlsWriter, "RCPT TO:<" + recipient + ">");
                expectSmtpCode(tlsReader, 250);
                sendSmtpLine(tlsWriter, "DATA");
                expectSmtpCode(tlsReader, 354);

                String encodedSubject = "=?UTF-8?B?" + Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8)) + "?=";
                String encodedBody = Base64.getMimeEncoder(76, new byte[]{'\r', '\n'}).encodeToString(htmlBody.getBytes(StandardCharsets.UTF_8));
                tlsWriter.write("From: =?UTF-8?B?" + Base64.getEncoder().encodeToString("SÖL Fitness".getBytes(StandardCharsets.UTF_8)) + "?= <" + smtpFrom + ">\r\n");
                tlsWriter.write("To: <" + recipient + ">\r\n");
                tlsWriter.write("Subject: " + encodedSubject + "\r\n");
                tlsWriter.write("MIME-Version: 1.0\r\n");
                tlsWriter.write("Content-Type: text/html; charset=UTF-8\r\n");
                tlsWriter.write("Content-Transfer-Encoding: base64\r\n");
                tlsWriter.write("\r\n");
                tlsWriter.write(encodedBody + "\r\n");
                tlsWriter.write(".\r\n");
                tlsWriter.flush();
                expectSmtpCode(tlsReader, 250);

                sendSmtpLine(tlsWriter, "QUIT");
            }
        } catch (IOException ex) {
            throw new ServiceUnavailableException("OTP_DELIVERY_FAILED", "auth.otp.delivery_failed", null, ex.getMessage());
        }
    }

    private static void sendSmtpLine(BufferedWriter writer, String command) throws IOException {
        writer.write(command);
        writer.write("\r\n");
        writer.flush();
    }

    private static void expectSmtpCode(BufferedReader reader, int expectedCode) throws IOException {
        String line;
        int lastCode = -1;
        StringBuilder response = new StringBuilder();
        while ((line = reader.readLine()) != null) {
            response.append(line).append(' ');
            if (line.length() >= 3 && Character.isDigit(line.charAt(0))
                    && Character.isDigit(line.charAt(1)) && Character.isDigit(line.charAt(2))) {
                lastCode = Integer.parseInt(line.substring(0, 3));
                if (line.length() == 3 || line.charAt(3) != '-') {
                    break;
                }
            } else {
                break;
            }
        }
        if (lastCode != expectedCode) {
            throw new IOException("SMTP expected " + expectedCode + " but received: " + response.toString().trim());
        }
    }
}
