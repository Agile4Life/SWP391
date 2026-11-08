package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ResendOtpDeliveryAdapterTest {

    @Test
    void sendPostsOtpEmailToResendApi() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

        MessageService messageService = mock(MessageService.class);
        when(messageService.getMessage("auth.otp.subject")).thenReturn("Mã xác thực SCMS");
        when(messageService.getMessage("auth.otp.email_body", "123456"))
                .thenReturn("Mã OTP của bạn là 123456. Mã hết hạn sau 5 phút.");

        server.expect(requestTo("https://api.resend.com/emails"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer re_test_123"))
                .andExpect(jsonPath("$.from").value("SÖL Fitness <onboarding@resend.dev>"))
                .andExpect(jsonPath("$.to[0]").value("member@example.com"))
                .andExpect(jsonPath("$.subject").value("Mã xác thực SCMS"))
                .andExpect(jsonPath("$.text").value("Mã OTP của bạn là 123456. Mã hết hạn sau 5 phút."))
                .andExpect(jsonPath("$.html").value(org.hamcrest.Matchers.containsString("1 2 3 4 5 6")))
                .andExpect(jsonPath("$.html").value(org.hamcrest.Matchers.containsString("SÖL")))
                .andRespond(withSuccess("{\"id\":\"email_123\"}", MediaType.APPLICATION_JSON));

        ResendOtpDeliveryAdapter adapter = new ResendOtpDeliveryAdapter(
                "re_test_123",
                "SÖL Fitness <onboarding@resend.dev>",
                messageService,
                builder.build()
        );

        adapter.send("member@example.com", "123456");

        server.verify();
    }

    @Test
    void sendRejectsNonEmailDestination() {
        ResendOtpDeliveryAdapter adapter = new ResendOtpDeliveryAdapter(
                "re_test_123",
                "onboarding@resend.dev",
                null,
                RestClient.create("https://api.resend.com")
        );

        ServiceUnavailableException ex = assertThrows(
                ServiceUnavailableException.class,
                () -> adapter.send("0912345678", "123456")
        );
        assertEquals("SMS_DELIVERY_DISABLED", ex.getErrorCode());
    }

    @Test
    void sendRejectsMissingApiKey() {
        ResendOtpDeliveryAdapter adapter = new ResendOtpDeliveryAdapter(
                "   ",
                "onboarding@resend.dev",
                null,
                RestClient.create("https://api.resend.com")
        );

        ServiceUnavailableException ex = assertThrows(
                ServiceUnavailableException.class,
                () -> adapter.send("member@example.com", "123456")
        );
        assertEquals("OTP_DELIVERY_DISABLED", ex.getErrorCode());
    }
}
