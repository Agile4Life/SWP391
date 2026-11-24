import { useCallback } from 'react';
import { getLanguage, sourceMessage, useI18n, translateSource, type SourceMessage } from '../../shared/i18n/language';
import { staffSourceCatalog } from './staffSourceCatalog';
import { notify as portalNotify } from '../../shared/lib/portalNotices';

/** Thông điệp của màn nhân sự: chuỗi, Error hoặc cặp vi/en. */
export type StaffMessage = string | Error | SourceMessage;

/**
 * Dịch chuỗi nguồn của màn nhân sự sang tiếng Anh bằng bảng nhãn riêng; không có bản dịch thì giữ nguyên.
 * Chỉ gọi với văn bản giao diện do mã nguồn sở hữu hoặc lỗi đã được bảo toàn tường minh.
 */
export function staffTranslation(source: string): string {
  const trimmed = source.trim().replace(/\s+/g, ' ');
  const english = staffSourceCatalog[trimmed];
  return english === undefined ? source : source.replace(source.trim(), english);
}

/** Hook dịch cho màn nhân sự: trả về ngôn ngữ, locale và hàm t() nhận chuỗi, Error hoặc cặp vi/en. */
export function useStaffI18n() {
  const { lang, t: translate } = useI18n();
  // Bản dịch lúc render theo dõi thay đổi ngôn ngữ; các effect tải dữ liệu giữ thông điệp nguồn và không phụ thuộc vào t.
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
 * Giữ nguyên nội dung Error từ backend/nghiệp vụ; chỉ dịch chuỗi dự phòng do mã nguồn định nghĩa.
 */
export function staffError(error: unknown, fallback: string): StaffMessage {
  return error instanceof Error && error.name === 'Error' && error.message ? error : fallback;
}

/** Tạo cặp thông điệp vi/en. */
export function staffMessage(vi: string, en: string): SourceMessage {
  return sourceMessage(vi, en);
}

/**
 * Hiện thông báo portal cho màn nhân sự, kèm bản dịch để nguồn thông điệp được giữ nguyên trong toast/hộp thư
 * ngay cả khi người dùng đổi tùy chọn ngôn ngữ về sau.
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
