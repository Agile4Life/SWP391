package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.auth.otp.delivery", havingValue = "smtp")
public class SmtpOtpDeliveryAdapter implements OtpDeliveryPort {

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final MessageService messageService;

    public SmtpOtpDeliveryAdapter(JavaMailSender mailSender,
                                  @Value("${app.auth.otp.from-address}") String fromAddress) {
        this(mailSender, fromAddress, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SmtpOtpDeliveryAdapter(JavaMailSender mailSender,
                                  @Value("${app.auth.otp.from-address}") String fromAddress,
                                  MessageService messageService) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.messageService = messageService;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    @Override
    public void send(String destination, String code) {
        if (!destination.contains("@")) {
            throw new ServiceUnavailableException("SMS_DELIVERY_DISABLED", "auth.otp.sms_not_supported", null, null);
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(destination);
        message.setSubject(msg("auth.otp.subject"));
        message.setText(msg("auth.otp.email_body", code));
        mailSender.send(message);
    }
}
