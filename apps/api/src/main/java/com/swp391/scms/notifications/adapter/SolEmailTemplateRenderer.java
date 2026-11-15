package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationPayload;

import java.util.Locale;

/**
 * Renders plain transactional HTML emails (OTP and important notifications).
 * One light card, one message, one action — no marketing blocks.
 */
public final class SolEmailTemplateRenderer {

    private static final String DEFAULT_PUBLIC_ORIGIN = "https://scms.bluesymphony.site";
    private static final String FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    private SolEmailTemplateRenderer() {
    }

    public static String resolvePublicOrigin(String configuredOrigin) {
        if (configuredOrigin == null || configuredOrigin.isBlank()) {
            return DEFAULT_PUBLIC_ORIGIN;
        }
        String trimmed = configuredOrigin.trim();
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.contains("localhost") || lower.contains("127.0.0.1")) {
            return DEFAULT_PUBLIC_ORIGIN;
        }
        return trimmed;
    }

    public static String renderOtpHtml(String otpCode, String subject, String plainTextBody, String configuredOrigin) {
        String baseUrl = resolvePublicOrigin(configuredOrigin);
        String code = escapeHtml(otpCode != null ? otpCode.trim() : "");
        String title = subject != null && !subject.isBlank() ? subject : "Mã xác thực SÖL Fitness";

        String body = """
                <p style="margin: 0 0 16px 0;">Dùng mã dưới đây để tiếp tục. Mã có hiệu lực trong 5 phút và chỉ dùng được một lần.</p>
                <div style="margin: 0 0 16px 0; padding: 18px 12px; background-color: #F4F4F5; border-radius: 8px; text-align: center; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #18181B;"><span style="-webkit-user-select: all; user-select: all;">%s</span></div>
                <p style="margin: 0; color: #71717A; font-size: 13px;">SÖL Fitness không bao giờ hỏi mã này qua điện thoại hoặc tin nhắn. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
                """.formatted(code);

        return wrap(title, "Mã của bạn là " + code + ". Có hiệu lực trong 5 phút.", body, null, null, baseUrl);
    }

    public static String renderNotificationHtml(
            NotificationPayload payload,
            String recipientName,
            String configuredOrigin) {
        String baseUrl = resolvePublicOrigin(configuredOrigin);
        String title = payload != null && payload.title() != null && !payload.title().isBlank()
                ? payload.title().trim()
                : "Thông báo từ SÖL Fitness";
        String message = payload != null && payload.message() != null ? payload.message().trim() : "";
        String type = payload != null && payload.type() != null ? payload.type().trim().toLowerCase(Locale.ROOT) : "";
        String greeting = recipientName != null && !recipientName.isBlank()
                ? "Xin chào " + escapeHtml(recipientName.trim()) + ","
                : "Xin chào,";

        String body = """
                <p style="margin: 0 0 12px 0;">%s</p>
                <p style="margin: 0;">%s</p>
                """.formatted(greeting, escapeHtml(message).replace("\n", "<br/>"));

        String[] cta = resolveCta(type);
        return wrap(title, message, body, cta[0], baseUrl + cta[1], baseUrl);
    }

    /** @return {label, path} of the single action button, chosen by notification type. */
    private static String[] resolveCta(String type) {
        return switch (type) {
            case "password_changed" -> new String[]{"Kiểm tra tài khoản", "/member/profile"};
            case "payment" -> new String[]{"Xem giao dịch", "/member/invoices"};
            case "schedule_change" -> new String[]{"Xem lịch tập", "/member/classes"};
            case "package_expiry" -> new String[]{"Gia hạn gói tập", "/member/packages"};
            default -> new String[]{"Mở SÖL Fitness", "/member"};
        };
    }

    private static String wrap(String title, String preheader, String bodyHtml, String ctaLabel, String ctaUrl, String baseUrl) {
        String button = ctaLabel == null ? "" : """
                <p style="margin: 24px 0 0 0;">
                  <a href="%s" style="display: inline-block; padding: 12px 22px; background-color: #F47A60; color: #18181B; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 6px;">%s</a>
                </p>
                """.formatted(escapeHtml(ctaUrl), escapeHtml(ctaLabel));

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>%s</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #F4F4F5; font-family: %s; color: #3F3F46; font-size: 15px; line-height: 1.6;">
                  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">%s</div>
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F4F4F5;">
                    <tr>
                      <td align="center" style="padding: 32px 16px;">
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 8px;">
                          <tr>
                            <td style="padding: 28px 28px 8px 28px;">
                              <a href="%s" style="font-size: 15px; font-weight: 800; letter-spacing: 0.08em; color: #18181B; text-decoration: none;">SÖL FITNESS</a>
                              <h1 style="margin: 20px 0 0 0; font-size: 20px; line-height: 1.35; font-weight: 700; color: #18181B;">%s</h1>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 28px 28px 28px;">
                              %s
                              %s
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 16px 0 0 0; font-size: 12px; color: #71717A;">Email tự động từ SÖL Fitness, vui lòng không trả lời.</p>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(title),
                FONT,
                escapeHtml(preheader),
                escapeHtml(baseUrl),
                escapeHtml(title),
                bodyHtml,
                button
        );
    }

    public static String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
