import { useCallback } from 'react';
import { getLanguage, sourceMessage, useI18n, translateSource, type SourceMessage } from '../../shared/i18n/language';
import { staffSourceCatalog } from './staffSourceCatalog';
import { notify as portalNotify } from '../../shared/lib/portalNotices';

/** Thông điệp của màn nhân sự: chuỗi, Error hoặc cặp vi/en. */
export type StaffMessage = string | Error | SourceMessage;

/**
 * Dịch chuỗi nguồn của màn nhân sự sang tiếng Anh bằng bảng nhãn riêng; không có bản dịch thì giữ nguyên.
 *
 * Only call with source-owned copy or an explicitly preserved error.
 */
export function staffTranslation(source: string): string {
  const trimmed = source.trim().replace(/\s+/g, ' ');
  const english = staffSourceCatalog[trimmed];
  return english === undefined ? source : source.replace(source.trim(), english);
}

/** Hook dịch cho màn nhân sự: trả về ngôn ngữ, locale và hàm t() nhận chuỗi, Error hoặc cặp vi/en. */
export function useStaffI18n() {
  const { lang, t: translate } = useI18n();
  // Render translations follow locale changes; data effects keep source messages and do not depend on t.
  // Dịch một thông điệp nhân sự theo ngôn ngữ hiện tại.
  const t = useCallback((source: StaffMessage | null | undefined, english?: string): string => {
    if (source == null) return '';
    if (typeof source !== 'string') {
      if (source instanceof Error) {
        const message = (source as Error & { translation?: SourceMessage }).translation;
        return message ? (lang === 'en' ? message.en : message.vi) : source.message;
      }
      return lang === 'en' ? source.en : source.vi;
    }
    return translateSource(source, english ?? staffSourceCatalog[source.trim().replace(/\s+/g, ' ')], lang);
  }, [lang]);
  return { lang, locale: lang === 'en' ? 'en-GB' : 'vi-VN', t, translate };
}

/**
 * Giữ nguyên lỗi từ backend; lỗi khác dùng chuỗi dự phòng.
 *
 * Keep backend/business Error content verbatim; translate only the source fallback.
 */
export function staffError(error: unknown, fallback: string): StaffMessage {
  return error instanceof Error && error.name === 'Error' && error.message ? error : fallback;
}

/** Tạo cặp thông điệp vi/en. */
export function staffMessage(vi: string, en: string): SourceMessage {
  return sourceMessage(vi, en);
}

/**
 * Hiện thông báo portal cho màn nhân sự, kèm bản dịch để đổi ngôn ngữ về sau vẫn đúng.
 *
 * Source provenance survives toast/inbox storage and later preference changes.
 */
export const staffNotify = (message: StaffMessage, type: Parameters<typeof portalNotify>[1] = 'info', options?: Parameters<typeof portalNotify>[2]) => {
  const translation = typeof message === 'string'
    ? sourceMessage(message, staffTranslation(message))
    : message instanceof Error ? (message as Error & { translation?: SourceMessage }).translation : message;
  const text = message instanceof Error ? message.message : typeof message === 'string' ? message : message.vi;
  if (translation) portalNotify(text, type, { ...options, translation });
  else if (options === undefined) portalNotify(text, type);
  else portalNotify(text, type, options);
};

/** Mã locale Intl theo ngôn ngữ hiện tại (en-GB hoặc vi-VN). */
export const staffLocale = () => getLanguage() === 'en' ? 'en-GB' : 'vi-VN';
/** Dịch chuỗi nguồn của màn nhân sự, ưu tiên bản tiếng Anh truyền vào. */
export const staffText = (source: string, english?: string) => translateSource(source, english ?? staffSourceCatalog[source.trim().replace(/\s+/g, ' ')]);
/** Tạo Error mang bản dịch song ngữ. */
export function staffSourceError(vi: string, en: string): Error {
  return Object.assign(new Error(vi), { translation: sourceMessage(vi, en) });
}
