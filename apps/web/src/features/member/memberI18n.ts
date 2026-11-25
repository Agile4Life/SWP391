import { getLanguage, sourceMessage, translateSource, type SourceMessage } from '../../shared/i18n/language';
import { englishLabels } from '../../shared/i18n/translations';
import { memberLabels } from './memberLabels';

/**
 * Dịch chuỗi nguồn của màn hội viên (chỉ gọi với nội dung nguồn do mã sở hữu, không dùng cho dữ liệu API hay nội dung người dùng).
 */
export function memberText(source: string, english?: string): string {
  if (getLanguage() !== 'en') return source;
  const key = source.trim().replace(/\s+/g, ' ');
  const translated = english ?? memberLabels[key] ?? englishLabels[key];
  return translateSource(source, translated);
}
/** Tạo cặp thông điệp vi/en cho màn hội viên. */
export function memberMessage(source: string, english?: string): SourceMessage {
  return sourceMessage(source, english ?? memberLabels[source.trim().replace(/\s+/g, ' ')] ?? englishLabels[source.trim()]);
}
/** Lấy chuỗi hiển thị theo ngôn ngữ hiện tại từ chuỗi hoặc cặp vi/en. */
export function memberRenderMessage(message: string | SourceMessage | null | undefined): string {
  if (!message) return '';
  return typeof message === 'string' ? message : getLanguage() === 'en' ? message.en : message.vi;
}
/** Giữ nguyên lỗi từ backend (kèm bản dịch nếu có); lỗi khác dùng câu dự phòng song ngữ. */
export function memberError(reason: unknown, fallback: string, english?: string): string | SourceMessage {
  if (reason instanceof Error && reason.name === 'Error' && reason.message) {
    const translated = (reason as Error & { translation?: SourceMessage }).translation;
    return translated ?? reason.message;
  }
  return memberMessage(fallback, english);
}
import { notify, type PortalNoticeType } from '../../shared/lib/portalNotices';

/**
 * Hiện thông báo portal kèm nguồn gốc song ngữ tường minh để khi đổi ngôn ngữ thì thông báo đang mở cũng đồng bộ theo.
 * Chuỗi lỗi động trả về từ API (không có trong từ điển nguồn) được giữ nguyên văn.
 */
export function memberNotify(message: SourceMessage | string, type: PortalNoticeType, options: Parameters<typeof notify>[2] = {}) {
  if (typeof message !== 'string') {
    notify(memberRenderMessage(message), type, { ...options, translation: message });
    return;
  }
  const key = message.trim().replace(/\s+/g, ' ');
  const known = memberLabels[key] ?? englishLabels[key];
  if (known) {
    const translation = sourceMessage(message, known);
    notify(memberRenderMessage(translation), type, { ...options, translation });
  } else {
    notify(message, type, options);
  }
}
