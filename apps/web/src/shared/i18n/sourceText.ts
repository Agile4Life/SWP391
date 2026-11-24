import { notify } from '../lib/portalNotices';
import { toast } from '../ui/toast';
import { getLanguage, translateSource, useI18n, type SourceMessage } from './language';
import { englishPublicLabels, vietnamesePublicLabels } from './publicLabels';


/** Dịch một chuỗi nguồn theo ngôn ngữ cho trước bằng bảng nhãn công khai (chuỗi gom khoảng trắng). */
function translatedSource(value: string, lang: 'vi' | 'en'): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const key = trimmed.replace(/\s+/g, ' ');
  const translated = Object.hasOwn(vietnamesePublicLabels, key)
    ? translateSource(vietnamesePublicLabels[key], key, lang)
    : translateSource(key, englishPublicLabels[key] ?? englishPublicLabels[value], lang);
  // Keep intentional separators in fragments such as " and {0} other items".
  return value.slice(0, value.indexOf(trimmed)) + translated.trim() + value.slice(value.indexOf(trimmed) + trimmed.length);
}

/**
 * Trả về chuỗi hiển thị theo ngôn ngữ hiện tại cho chuỗi, Error hoặc cặp vi/en.
 *
 * Only call for source-owned copy; API errors and catalog/user fields stay verbatim.
 */
export function sourceText(value: string | Error | SourceMessage): string {
  if (value instanceof Error) {
    const pair = (value as Error & { translation?: SourceMessage }).translation;
    return pair ? (getLanguage() === 'en' ? pair.en : pair.vi) : value.message;
  }
  if (typeof value !== 'string') return getLanguage() === 'en' ? value.en : value.vi;
  return translatedSource(value, getLanguage());
}

/** Dịch chuỗi nguồn rồi thay {0}, {1}... bằng các giá trị truyền vào. */
export function sourceFormat(source: string, ...values: unknown[]): string {
  return sourceText(source).replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}

/** Tạo cặp vi/en từ một chuỗi nguồn. */
export function sourcePair(source: string): SourceMessage {
  return { vi: translatedSource(source, 'vi'), en: translatedSource(source, 'en') };
}

/**
 * Giữ nguyên lỗi từ API; lỗi khác được thay bằng lỗi mang bản dịch song ngữ của fallback.
 *
 * Preserve backend messages, while retaining bilingual provenance for client fallbacks.
 */
export function sourceError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.name === 'Error' && error.message) return error;
  return Object.assign(new Error(fallback), { translation: sourcePair(fallback) });
}

/**
 * Hook để component render lại khi đổi ngôn ngữ (cho bảng tĩnh dịch lúc render).
 *
 * A subscription for source-owned static tables whose getters resolve during rendering.
 */
export function useSourceLanguage(): void {
  useI18n();
}

/** Tạo cặp vi/en từ chuỗi nguồn rồi thay {0}, {1}... ở cả hai bản. */
export function sourceFormatPair(source: string, ...values: unknown[]): SourceMessage {
  const pair = sourcePair(source);
  // Thay {số} trong chuỗi bằng giá trị tương ứng.
  const fill = (text: string) => text.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
  return { vi: fill(pair.vi), en: fill(pair.en) };
}

/**
 * Lấy cặp bản dịch đi kèm thông báo: Error dùng bản dịch của nó, chuỗi có trong bảng nhãn thì tạo cặp, còn lại
 * không có.
 */
function noticePair(value: string | Error | SourceMessage): SourceMessage | undefined {
  if (value instanceof Error) return (value as Error & { translation?: SourceMessage }).translation;
  if (typeof value !== 'string') return value;
  return Object.hasOwn(englishPublicLabels, value) ? sourcePair(value) : undefined;
}

/** Hiện thông báo trong portal, kèm bản dịch nếu có. */
export function sourceNotify(value: string | Error | SourceMessage, type?: Parameters<typeof notify>[1], options?: Parameters<typeof notify>[2]): void {
  const translation = noticePair(value);
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : value.vi;
  if (translation) notify(message, type, { ...options, translation });
  else if (options !== undefined) notify(message, type, options);
  else notify(message, type);
}

/** Hiện toast thành công/lỗi, kèm bản dịch nếu có. */
export function sourceToast(value: string | Error | SourceMessage, type: 'success' | 'error' = 'success'): void {
  const translation = noticePair(value);
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : value.vi;
  if (translation) toast(message, type, translation);
  else toast(message, type);
}
/** Hiện toast theo phương thức toast.success/toast.error, kèm bản dịch nếu có. */
function sourceToastMethod(value: string | Error | SourceMessage, type: 'success' | 'error'): void {
  const translation = noticePair(value);
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : value.vi;
  if (translation) toast[type](message, translation);
  else toast[type](message);
}
sourceToast.success = (value: string | Error | SourceMessage) => sourceToastMethod(value, 'success');
sourceToast.error = (value: string | Error | SourceMessage) => sourceToastMethod(value, 'error');
