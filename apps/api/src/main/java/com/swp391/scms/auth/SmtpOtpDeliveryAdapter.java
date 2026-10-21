package com.swp391.scms.auth;

import com.swp391.scms.common.exception.ServiceUnavailableException;
import com.swp391.scms.common.i18n.MessageService;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@ConditionalOnProperty(name = "app.auth.otp.delivery", havingValue = "smtp")
public class SmtpOtpDeliveryAdapter implements OtpDeliveryPort {

    private static final Logger log = LoggerFactory.getLogger(SmtpOtpDeliveryAdapter.class);

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

        String subject = msg("auth.otp.subject");
        String plainText = msg("auth.otp.email_body", code);

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
            try {
                helper.setFrom(fromAddress, "SCMS Sports Center");
            } catch (Exception e) {
                helper.setFrom(fromAddress);
            }
            helper.setTo(destination);
            helper.setSubject(subject);

            String html = buildLuxuryOtpHtml(code);
            helper.setText(plainText, html);

            mailSender.send(mimeMessage);
            log.info("Sent luxury HTML OTP email to {}", destination);
        } catch (Exception ex) {
            log.warn("Failed to send HTML OTP email to {}, falling back to plain text: {}", destination, ex.getMessage());
            SimpleMailMessage fallback = new SimpleMailMessage();
            fallback.setFrom(fromAddress);
            fallback.setTo(destination);
            fallback.setSubject(subject);
            fallback.setText(plainText);
            mailSender.send(fallback);
        }
    }

    private String buildLuxuryOtpHtml(String code) {
        return """
            <!DOCTYPE html>
            <html lang="vi">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Mã xác thực SCMS</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #F5EFEB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2B2520;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F5EFEB; padding: 40px 15px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(33, 28, 24, 0.08); border: 1px solid #E5DFD7;">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #1A1614 0%, #352E28 100%); padding: 36px 32px 30px; text-align: center; border-bottom: 3px solid #C2A684;">
                          <div style="font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #C2A684; text-transform: uppercase; margin-bottom: 6px;">
                            SPORTS CENTER MANAGEMENT
                          </div>
                          <div style="font-size: 26px; font-weight: 800; color: #FAF8F5; letter-spacing: 1px; margin: 0;">
                            SCMS <span style="color: #C2A684;">✦</span> LUXURY FITNESS
                          </div>
                        </td>
                      </tr>
                      <!-- Body -->
                      <tr>
                        <td style="padding: 36px 36px 28px;">
                          <h1 style="font-size: 22px; font-weight: 700; color: #1A1614; margin: 0 0 14px 0; text-align: center;">
                            Mã Xác Thực Bảo Mật (OTP)
                          </h1>
                          <p style="font-size: 15px; line-height: 1.6; color: #4A4541; margin: 0 0 24px 0; text-align: center;">
                            Xin chào Quý hội viên,<br>
                            Bạn vừa yêu cầu mã OTP để đăng nhập hoặc xác thực tài khoản tại trung tâm thể thao <strong>SCMS</strong>. Vui lòng sử dụng mã số bên dưới để tiếp tục:
                          </p>

                          <!-- OTP Code Box -->
                          <div style="background-color: #FAF6F0; border: 2px dashed #C2A684; border-radius: 12px; padding: 24px 16px 20px; text-align: center; margin: 0 0 26px 0;">
                            <div style="font-size: 12px; font-weight: 700; color: #8C7862; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
                              MÃ XÁC THỰC CỦA BẠN
                            </div>
                            <div style="font-family: 'SF Pro Display', Monaco, Consolas, 'Courier New', monospace; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #1A1614; padding-left: 12px; margin: 0 auto; user-select: all;">
                              """ + code + """
                            </div>
                            <div style="display: inline-block; margin-top: 14px; padding: 4px 12px; border-radius: 20px; background-color: rgba(46, 107, 79, 0.1); color: #2E6B4F; font-size: 12px; font-weight: 600;">
                              ⏱ Hiệu lực trong vòng 5 phút
                            </div>
                          </div>

                          <!-- Security Notice -->
                          <div style="background-color: #FBF9F6; border-left: 4px solid #C2A684; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #5C5248;">
                              🔒 <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên SCMS. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc đổi mật khẩu tài khoản ngay lập tức.
                            </p>
                          </div>

                          <p style="font-size: 13px; color: #7E7771; line-height: 1.5; margin: 0; text-align: center;">
                            Cảm ơn bạn đã đồng hành cùng hệ sinh thái thể thao SCMS.
                          </p>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #FAF8F5; border-top: 1px solid #ECE7E1; padding: 24px 32px; text-align: center;">
                          <div style="font-size: 13px; font-weight: 700; color: #211C18; margin-bottom: 4px;">
                            SCMS - Sports Center Management System
                          </div>
                          <div style="font-size: 12px; color: #7E7771; line-height: 1.5; margin-bottom: 8px;">
                            Trung tâm Thể dục Thể thao &amp; Đào tạo Thể chất Chuyên nghiệp
                          </div>
                          <div style="font-size: 11px; color: #A69E96;">
                            Email tự động từ hệ thống bảo mật • Vui lòng không trả lời thư này
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }
}

