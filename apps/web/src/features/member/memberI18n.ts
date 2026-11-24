import { getLanguage, sourceMessage, translateSource, type SourceMessage } from '../../shared/i18n/language';
import { englishLabels } from '../../shared/i18n/translations';
import { memberLabels } from './memberLabels';

/**
 * Dịch chuỗi nguồn của màn hội viên (không dùng cho dữ liệu API hay nội dung người dùng).
 *
 * Only call with source-owned copy, never API or user text.
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
export function memberError(reason: unknown, fallback: string): string | SourceMessage {
  if (reason instanceof Error && reason.name === 'Error' && reason.message) {
    const translated = (reason as Error & { translation?: SourceMessage }).translation;
    return translated ?? reason.message;
  }
  return memberMessage(fallback);
}
import { notify, type PortalNoticeType } from '../../shared/lib/portalNotices';

/**
 * Hiện thông báo portal kèm bản dịch để đổi ngôn ngữ thì thông báo đang mở cũng đổi theo.
 *
 * Explicit bilingual provenance keeps an open notice synchronized with the selected language.
 */
export function memberNotify(message: SourceMessage | string, type: PortalNoticeType, options: Parameters<typeof notify>[2] = {}) {
  const translation = typeof message === 'string' ? memberMessage(message) : message;
  notify(memberRenderMessage(translation), type, { ...options, translation });
}
