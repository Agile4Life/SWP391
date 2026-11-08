package com.swp391.scms.notifications.adapter;

import com.swp391.scms.notifications.port.NotificationPayload;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Renders SÖL Fitness Charcoal–Salmon luxury HTML emails for OTP and multi-channel notifications.
 */
public final class SolEmailTemplateRenderer {

    private static final String DEFAULT_PUBLIC_ORIGIN = "https://scms.bluesymphony.site";
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm · dd/MM/yyyy");
    private static final Pattern HIGHLIGHT_TOKEN = Pattern.compile(
            "(\\+?\\d[\\d.,]*\\s*(?:VNĐ|VND|đ|%)|#[A-Za-z0-9_-]{3,}|SOL-[A-Za-z0-9-]+)"
    );

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
        String safeCode = escapeHtml(otpCode != null ? otpCode.trim() : "");
        String spacedCode = safeCode.replaceAll("(.)", "$1 ").trim();
        String safeSubject = escapeHtml(subject != null && !subject.isBlank()
                ? subject
                : "Mã xác thực bảo mật SÖL Fitness");
        String timestamp = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).format(TIME_FMT);

        String preheader = "Mã xác thực OTP SÖL Fitness của bạn là " + safeCode
                + " (Có hiệu lực trong 5 phút). Tuyệt đối không chia sẻ mã này.";

        String bodyContent = """
                <div style="margin-bottom: 22px;">
                  <p style="margin: 0 0 12px 0; color: #E4E4E7; font-size: 15px; line-height: 1.7;">
                    Xin chào <strong style="color: #FFFFFF;">Hội viên SÖL Fitness</strong>,
                  </p>
                  <p style="margin: 0; color: #A1A1AA; font-size: 14px; line-height: 1.7;">
                    Chúng tôi vừa nhận được yêu cầu xác thực bảo mật trên tài khoản của bạn. Hãy nhập mã gồm 6 chữ số dưới đây để tiếp tục hành trình tập luyện tại <strong style="color: #F47A60;">SÖL Fitness</strong>:
                  </p>
                </div>

                <!-- OTP Vault Box -->
                <div style="background: linear-gradient(180deg, #151518 0%%, #19191D 100%%); border: 2px dashed #F47A60; border-radius: 18px; padding: 28px 20px; text-align: center; margin: 24px 0;">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em; color: #A1A1AA; margin-bottom: 12px;">
                    MÃ XÁC THỰC BẢO MẬT (OTP)
                  </div>
                  <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #F47A60; padding: 6px 0; text-shadow: 0 2px 18px rgba(244, 122, 96, 0.28);">
                    %s
                  </div>
                  <div style="margin-top: 14px;">
                    <span style="display: inline-block; background-color: rgba(244, 122, 96, 0.14); border: 1px solid rgba(244, 122, 96, 0.35); color: #FDBA74; font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 999px;">
                      Hiệu lực trong 05:00 phút - Chỉ sử dụng 01 lần
                    </span>
                  </div>
                </div>

                <!-- Security Checklist -->
                <div style="background-color: #232329; border-left: 4px solid #F47A60; border-radius: 12px; padding: 16px 18px; margin-bottom: 24px;">
                  <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #F47A60; margin-bottom: 8px;">
                    LƯU Ý AN TOÀN TÀI KHOẢN
                  </div>
                  <p style="margin: 0; color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                    Đội ngũ Lễ tân &amp; Huấn luyện viên SÖL Fitness <strong>không bao giờ</strong> yêu cầu bạn cung cấp mã OTP qua điện thoại hay tin nhắn. Nếu không phải bạn vừa thực hiện thao tác này, vui lòng bỏ qua email này.
                  </p>
                </div>
                """.formatted(spacedCode.isEmpty() ? safeCode : spacedCode);

        return wrapMasterLayout(
                preheader,
                "BẢO MẬT 2 LỚP",
                "SECURITY & VERIFICATION",
                safeSubject,
                bodyContent,
                "Truy cập Cổng Hội Viên SÖL",
                baseUrl + "/login",
                timestamp,
                baseUrl
        );
    }

    public static String renderNotificationHtml(
            NotificationPayload payload,
            String recipientName,
            String configuredOrigin) {
        String baseUrl = resolvePublicOrigin(configuredOrigin);
        String rawTitle = payload != null && payload.title() != null && !payload.title().isBlank()
                ? payload.title().trim()
                : "Thông báo mới từ SÖL Fitness";
        String rawMessage = payload != null && payload.message() != null
                ? payload.message().trim()
                : "";
        String type = payload != null && payload.type() != null ? payload.type().trim().toLowerCase(Locale.ROOT) : "system";
        String entityType = payload != null && payload.relatedEntityType() != null
                ? payload.relatedEntityType().trim().toLowerCase(Locale.ROOT)
                : "";
        Long entityId = payload != null ? payload.relatedEntityId() : null;

        CategoryMeta meta = resolveCategoryMeta(type, entityType, entityId, rawTitle, baseUrl);
        String greetingName = (recipientName != null && !recipientName.isBlank())
                ? escapeHtml(recipientName.trim())
                : "Hội viên SÖL Fitness";
        String formattedMessage = highlightMessageHtml(rawMessage);
        String timestamp = (payload != null && payload.timestamp() != null
                ? payload.timestamp()
                : LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))).format(TIME_FMT);

        String preheader = escapeHtml(rawTitle + " — " + rawMessage);

        String bodyContent = """
                <div style="margin-bottom: 20px;">
                  <p style="margin: 0 0 10px 0; color: #E4E4E7; font-size: 15px; line-height: 1.7;">
                    Xin chào <strong style="color: #FFFFFF;">%s</strong>,
                  </p>
                  <p style="margin: 0; color: #A1A1AA; font-size: 14px; line-height: 1.7;">
                    %s
                  </p>
                </div>

                <!-- Main Notification Callout Card -->
                <div style="background: linear-gradient(145deg, #232329 0%%, #1E1E24 100%%); border: 1px solid #32323A; border-left: 4px solid %s; border-radius: 16px; padding: 22px 22px; margin: 22px 0;">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: %s; margin-bottom: 10px;">
                    %s
                  </div>
                  <div style="color: #F4F4F6; font-size: 15px; line-height: 1.75; font-weight: 500;">
                    %s
                  </div>
                </div>

                %s
                """.formatted(
                greetingName,
                meta.introHook(),
                meta.accentColor(),
                meta.accentColor(),
                meta.cardHeaderLabel(),
                formattedMessage,
                meta.engagementBlockHtml()
        );

        return wrapMasterLayout(
                preheader,
                meta.badgeLabel(),
                meta.eyebrow(),
                escapeHtml(rawTitle),
                bodyContent,
                meta.ctaLabel(),
                meta.ctaUrl(),
                timestamp,
                baseUrl
        );
    }

    private static String wrapMasterLayout(
            String preheader,
            String badgeLabel,
            String eyebrow,
            String heroTitle,
            String mainBodyHtml,
            String ctaLabel,
            String ctaUrl,
            String timestamp,
            String baseUrl) {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <meta name="color-scheme" content="dark light" />
                  <title>%s</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #121215; color: #F5F5F7; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
                  <!-- Hidden Inbox Preheader -->
                  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: #121215;">
                    %s &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
                  </div>

                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background-color: #121215; padding: 32px 12px;">
                    <tr>
                      <td align="center">
                        <!-- Main Card Container -->
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #1C1C1E; border: 1px solid #2E2E34; border-radius: 22px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);">
                          <!-- Top Salmon Gradient Bar -->
                          <tr>
                            <td style="height: 5px; background: linear-gradient(90deg, #F47A60 0%%, #FF9E80 50%%, #E05D44 100%%); font-size: 0; line-height: 0;">&nbsp;</td>
                          </tr>

                          <!-- Top Brand Header -->
                          <tr>
                            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #28282F;">
                              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="left" valign="middle">
                                    <a href="%s" style="text-decoration: none; display: inline-block;">
                                      <span style="font-size: 26px; font-weight: 900; letter-spacing: 0.14em; color: #FFFFFF;">SÖL</span>
                                      <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.28em; color: #F47A60; margin-left: 6px; vertical-align: middle;">FITNESS</span>
                                    </a>
                                    <div style="font-size: 11px; color: #71717A; letter-spacing: 0.06em; margin-top: 3px;">
                                      SCULPTING STRENGTH · ELEVATING SPIRIT
                                    </div>
                                  </td>
                                  <td align="right" valign="middle">
                                    <span style="display: inline-block; background-color: rgba(244, 122, 96, 0.14); border: 1px solid rgba(244, 122, 96, 0.35); color: #F47A60; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; padding: 6px 12px; border-radius: 999px; text-transform: uppercase;">
                                      %s
                                    </span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Hero Title Section -->
                          <tr>
                            <td style="padding: 28px 32px 8px 32px;">
                              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #F47A60; margin-bottom: 8px;">
                                %s
                              </div>
                              <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.32; color: #FFFFFF; letter-spacing: -0.01em;">
                                %s
                              </h1>
                            </td>
                          </tr>

                          <!-- Main Body Content -->
                          <tr>
                            <td style="padding: 12px 32px 24px 32px;">
                              %s

                              <!-- Primary CTA Button -->
                              <div style="text-align: center; margin: 28px 0 12px 0;">
                                <a href="%s" style="display: inline-block; background: linear-gradient(135deg, #F47A60 0%%, #E05D44 100%%); color: #141416; font-size: 14px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em; padding: 15px 34px; border-radius: 999px; box-shadow: 0 10px 24px rgba(244, 122, 96, 0.28);">
                                  %s
                                </a>
                              </div>
                            </td>
                          </tr>

                          <!-- Motivational Quote & 3-Pillar Lifestyle Strip -->
                          <tr>
                            <td style="padding: 22px 32px; background-color: #161619; border-top: 1px solid #28282F; border-bottom: 1px solid #28282F;">
                              <p style="margin: 0 0 16px 0; text-align: center; font-style: italic; color: #D4D4D8; font-size: 13px; line-height: 1.6;">
                                “Mỗi giọt mồ hôi rơi xuống tại phòng tập hôm nay là phiên bản mạnh mẽ, tự tin hơn của chính bạn vào ngày mai.”
                              </p>
                              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td width="33%%" align="center" style="padding: 10px 6px; background-color: #1F1F24; border-radius: 10px;">
                                    <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.06em;">PT 1:1</div>
                                    <div style="font-size: 11px; color: #A1A1AA; margin-top: 3px;">Lộ trình cá nhân</div>
                                  </td>
                                  <td width="2%%">&nbsp;</td>
                                  <td width="30%%" align="center" style="padding: 10px 6px; background-color: #1F1F24; border-radius: 10px;">
                                    <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.06em;">Studio &amp; Sân</div>
                                    <div style="font-size: 11px; color: #A1A1AA; margin-top: 3px;">Đặt lịch 1 chạm</div>
                                  </td>
                                  <td width="2%%">&nbsp;</td>
                                  <td width="33%%" align="center" style="padding: 10px 6px; background-color: #1F1F24; border-radius: 10px;">
                                    <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.06em;">Ví SÖL Pay</div>
                                    <div style="font-size: 11px; color: #A1A1AA; margin-top: 3px;">Thanh toán tức thì</div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Footer -->
                          <tr>
                            <td style="padding: 24px 32px; text-align: center; background-color: #141417;">
                              <div style="margin-bottom: 12px;">
                                <a href="%s/member/packages" style="color: #A1A1AA; font-size: 12px; text-decoration: none; margin: 0 8px;">Gói tập &amp; Ví SÖL</a>
                                <span style="color: #3F3F46;">·</span>
                                <a href="%s/member/schedule" style="color: #A1A1AA; font-size: 12px; text-decoration: none; margin: 0 8px;">Lịch lớp &amp; PT</a>
                                <span style="color: #3F3F46;">·</span>
                                <a href="%s/member/courts" style="color: #A1A1AA; font-size: 12px; text-decoration: none; margin: 0 8px;">Đặt sân</a>
                                <span style="color: #3F3F46;">·</span>
                                <a href="%s/member/support" style="color: #A1A1AA; font-size: 12px; text-decoration: none; margin: 0 8px;">Hỗ trợ 24/7</a>
                              </div>
                              <div style="font-size: 11px; color: #71717A; line-height: 1.6;">
                                <strong style="color: #A1A1AA;">SÖL FITNESS &amp; LIFESTYLE CLUB</strong><br/>
                                Giờ mở cửa: 05:30 – 22:00 (Thứ Hai – Chủ Nhật) · Thời gian ghi nhận: %s<br/>
                                Email tự động từ hệ thống SÖL Fitness. Vui lòng truy cập Cổng Hội Viên để được hỗ trợ trực tiếp.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                heroTitle,
                preheader,
                baseUrl,
                badgeLabel,
                eyebrow,
                heroTitle,
                mainBodyHtml,
                ctaUrl,
                ctaLabel,
                baseUrl,
                baseUrl,
                baseUrl,
                baseUrl,
                timestamp
        );
    }

    private static CategoryMeta resolveCategoryMeta(
            String type,
            String entityType,
            Long entityId,
            String rawTitle,
            String baseUrl) {
        String lowerTitle = rawTitle.toLowerCase(Locale.ROOT);

        if ("wallet".equals(entityType) || lowerTitle.contains("ví söl") || lowerTitle.contains("nạp tiền")) {
            return new CategoryMeta(
                    "VÍ ĐIỆN TỬ SÖL",
                    "SÖL WALLET · INSTANT BALANCE UPDATE",
                    "#10B981",
                    "CHI TIẾT BIẾN ĐỘNG SỐ DƯ VÍ SÖL",
                    "Ví điện tử SÖL của bạn vừa được cập nhật thành công. Toàn bộ số dư được bảo chứng an toàn và sẵn sàng cho mọi dịch vụ tại câu lạc bộ:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Trải nghiệm 1 chạm cùng Ví SÖL
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Gia hạn gói tập, đặt lịch Huấn luyện viên PT 1:1 hoặc giữ chỗ sân Tennis / Cầu lông / Bơi lội tức thì.<br/>
                        Nhận hoàn tiền tự động 100%% về Ví khi hủy lịch hợp lệ hoặc được duyệt hoàn gói tập.
                      </div>
                    </div>
                    """,
                    "Mở Ví SÖL & Khám phá Đặc quyền",
                    baseUrl + "/member/packages"
            );
        }

        if ("order".equals(type) || "product_order".equals(entityType) || lowerTitle.contains("đơn hàng") || lowerTitle.contains("đơn #")) {
            String orderPath = entityId != null ? ("/member/orders/" + entityId) : "/member/orders";
            return new CategoryMeta(
                    "SÖL PRO SHOP",
                    "PRO SHOP & NUTRITION · ORDER UPDATE",
                    "#F47A60",
                    "THÔNG TIN ĐƠN HÀNG SÖL PRO SHOP",
                    "Cảm ơn bạn đã lựa chọn phụ kiện & dinh dưỡng thể thao chính hãng tại SÖL Pro Shop. Dưới đây là cập nhật mới nhất về đơn hàng của bạn:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Hướng dẫn nhận hàng nhanh
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Với đơn <strong>Nhận tại quầy</strong>: Xuất trình mã đơn hàng tại quầy Lễ tân SÖL Fitness ngay trong buổi tập tiếp theo.<br/>
                        Với đơn <strong>Giao tận nơi</strong>: Theo dõi trạng thái vận chuyển theo thời gian thực trên Cổng Hội Viên.
                      </div>
                    </div>
                    """,
                    "Xem Chi tiết Đơn hàng",
                    baseUrl + orderPath
            );
        }

        if ("payment".equals(type) || "payment".equals(entityType)) {
            return new CategoryMeta(
                    "THANH TOÁN THÀNH CÔNG",
                    "VERIFIED PAYMENT & E-INVOICE",
                    "#10B981",
                    "BIÊN LAI XÁC NHẬN GIAO DỊCH",
                    "Cảm ơn bạn đã đầu tư cho sức khỏe và phong cách sống năng động cùng SÖL Fitness. Giao dịch của bạn đã được hệ thống xác nhận:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Hóa đơn điện tử tự động
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Hóa đơn điện tử và lịch sử giao dịch đã được lưu trữ trong hồ sơ hội viên của bạn. Bạn có thể tra cứu bất cứ lúc nào tại mục <strong>Giao dịch &amp; Hóa đơn</strong>.
                      </div>
                    </div>
                    """,
                    "Xem Giao dịch & Hóa đơn",
                    baseUrl + "/member/invoices"
            );
        }

        if ("package_expiry".equals(type) || "membership_subscription".equals(entityType) || lowerTitle.contains("gói tập") || lowerTitle.contains("tập thử")) {
            return new CategoryMeta(
                    "ĐẶC QUYỀN HỘI VIÊN",
                    "SÖL MEMBERSHIP & PRIVILEGES",
                    "#F59E0B",
                    "CẬP NHẬT GÓI TẬP HỘI VIÊN",
                    "Hành trình chinh phục hình thể và sức bền của bạn tại SÖL Fitness có thông tin cập nhật quan trọng:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Giữ vững chuỗi ngày tập luyện (Workout Streak)
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Duy trì gói tập liên tục để giữ nguyên quyền đặt chỗ sớm các lớp Studio giờ vàng và lịch PT 1:1.<br/>
                        Nâng cấp hoặc gia hạn trực tuyến chỉ trong 30 giây qua Ví SÖL hoặc VNPay.
                      </div>
                    </div>
                    """,
                    "Quản lý Gói tập Hội viên",
                    baseUrl + "/member/packages"
            );
        }

        if ("class_reminder".equals(type) || "schedule_change".equals(type) || "booking".equals(type)
                || "class_session".equals(entityType) || "class_enrollment".equals(entityType)
                || lowerTitle.contains("lịch") || lowerTitle.contains("lớp") || lowerTitle.contains("buổi tập")) {
            return new CategoryMeta(
                    "LỊCH TẬP & STUDIO",
                    "STUDIO CLASSES & TRAINING SCHEDULE",
                    "#F47A60",
                    "THÔNG TIN LỊCH TẬP CỦA BẠN",
                    "Năng lượng phòng tập đang chờ đón bạn! Dưới đây là thông tin chi tiết về lịch tập luyện của bạn tại SÖL Fitness:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Chuẩn bị cho buổi tập hoàn hảo
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        <strong>Check-in trước 10 phút</strong>: Mở mã QR Hội viên để check-in nhanh tại cổng và khởi động làm nóng khớp.<br/>
                        <strong>Nạp nước hợp lý</strong>: Mang theo bình nước cá nhân để bù khoáng trong suốt buổi tập.<br/>
                        <strong>Linh hoạt</strong>: Nếu thay đổi kế hoạch, bạn có thể quản lý lịch đặt trực tiếp trên Cổng Hội Viên.
                      </div>
                    </div>
                    """,
                    "Xem Lịch tập & Mã QR Check-in",
                    baseUrl + "/member/classes"
            );
        }

        if ("support_reply".equals(type) || "support_request".equals(entityType) || lowerTitle.contains("hỗ trợ")) {
            return new CategoryMeta(
                    "SÖL CONCIERGE",
                    "MEMBER CARE & PRIORITY SUPPORT",
                    "#60A5FA",
                    "PHẢN HỒI TỪ CHĂM SÓC HỘI VIÊN",
                    "Đội ngũ Chăm sóc Hội viên SÖL Concierge vừa cập nhật phản hồi cho yêu cầu hỗ trợ của bạn:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #60A5FA; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Đồng hành 24/7 cùng Hội viên
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Bạn có thể nhấn vào nút bên dưới để xem toàn bộ cuộc trò chuyện hoặc gửi thêm câu hỏi trực tiếp cho ban quản lý câu lạc bộ.
                      </div>
                    </div>
                    """,
                    "Mở Phiếu Hỗ trợ trên Portal",
                    baseUrl + "/member/support"
            );
        }

        if ("password_changed".equals(type) || "password_changed".equals(entityType) || lowerTitle.contains("mật khẩu")) {
            return new CategoryMeta(
                    "BẢO MẬT TÀI KHOẢN",
                    "ACCOUNT SECURITY ALERT",
                    "#F47A60",
                    "THÔNG BÁO BẢO MẬT TÀI KHOẢN",
                    "Hệ thống bảo mật SÖL Fitness vừa ghi nhận thay đổi thông tin xác thực trên tài khoản của bạn:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Khuyến nghị bảo mật
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Nếu chính bạn vừa thực hiện thay đổi này, tài khoản của bạn hoàn toàn an toàn. Nếu không phải bạn, vui lòng đặt lại mật khẩu ngay lập tức.
                      </div>
                    </div>
                    """,
                    "Kiểm tra Hồ sơ & Bảo mật",
                    baseUrl + "/member/profile"
            );
        }

        if ("training_plan".equals(entityType) || lowerTitle.contains("huấn luyện") || lowerTitle.contains("đánh giá") || lowerTitle.contains("pt")) {
            return new CategoryMeta(
                    "HUẤN LUYỆN PT 1:1",
                    "PERSONAL COACHING & PROGRESS",
                    "#F47A60",
                    "CẬP NHẬT LỘ TRÌNH & ĐÁNH GIÁ TẬP LUYỆN",
                    "Huấn luyện viên cá nhân của bạn vừa cập nhật thông tin lộ trình tập luyện tại SÖL Fitness:",
                    """
                    <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                      <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                        Theo dõi sát sao từng bước tiến bộ
                      </div>
                      <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                        Xem chi tiết nhận xét kỹ thuật, chỉ số hình thể (BMI, % cơ - mỡ) và mục tiêu buổi tập tiếp theo ngay trên bảng Tiến độ Tập luyện.
                      </div>
                    </div>
                    """,
                    "Xem Tiến độ & Lộ trình PT",
                    baseUrl + "/member/progress"
            );
        }

        return new CategoryMeta(
                "THÔNG BÁO SÖL",
                "SÖL FITNESS CLUB UPDATE",
                "#F47A60",
                "THÔNG TIN DÀNH CHO HỘI VIÊN",
                "Chào mừng bạn quay lại với không gian tập luyện năng động tại SÖL Fitness. Dưới đây là thông báo mới nhất dành cho bạn:",
                """
                <div style="background-color: #1F1F25; border: 1px solid #2E2E36; border-radius: 14px; padding: 16px 18px; margin-top: 16px;">
                  <div style="font-size: 12px; font-weight: 700; color: #F47A60; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                    Sẵn sàng bứt phá giới hạn hôm nay
                  </div>
                  <div style="color: #D4D4D8; font-size: 13px; line-height: 1.65;">
                    Đặt lịch lớp tập yêu thích, kiểm tra tiến độ thể hình và tận hưởng không gian tập luyện chuẩn quốc tế tại SÖL Fitness.
                  </div>
                </div>
                """,
                "Truy cập Cổng Hội Viên SÖL",
                baseUrl + "/member"
        );
    }

    private static String highlightMessageHtml(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "";
        }
        String escaped = escapeHtml(rawMessage).replace("\n", "<br/>");
        Matcher matcher = HIGHLIGHT_TOKEN.matcher(escaped);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String token = matcher.group(1);
            String replacement = "<strong style=\"color: #F47A60; font-weight: 800;\">"
                    + Matcher.quoteReplacement(token) + "</strong>";
            matcher.appendReplacement(sb, replacement);
        }
        matcher.appendTail(sb);
        return sb.toString();
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

    private record CategoryMeta(
            String badgeLabel,
            String eyebrow,
            String accentColor,
            String cardHeaderLabel,
            String introHook,
            String engagementBlockHtml,
            String ctaLabel,
            String ctaUrl
    ) {
    }
}
