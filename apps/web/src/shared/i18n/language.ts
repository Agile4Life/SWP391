import { englishLabels } from './translations';
import { useCallback, useEffect, useSyncExternalStore, type RefObject } from 'react';

/** Ngôn ngữ giao diện được hỗ trợ: tiếng Việt hoặc tiếng Anh. */
export type Language = 'vi' | 'en';

export const LANGUAGE_STORAGE_KEY = 'scms_lang';

const listeners = new Set<() => void>();

/** Chuẩn hóa mã ngôn ngữ: bắt đầu bằng "en" thì là tiếng Anh, còn lại mặc định tiếng Việt. */
function normalizeLanguage(value: string | null | undefined): Language {
  if (value && /^en(?:[-_]|$)/i.test(value)) {
    return 'en';
  }
  return 'vi';
}

/** Đọc ngôn ngữ đã lưu trong localStorage (mặc định tiếng Việt, kể cả khi không có window hoặc storage lỗi). */
export function getLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'vi';
  }
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'vi';
  }
}

/** Ghi ngôn ngữ vào thuộc tính lang và data-lang của thẻ html. */
function applyDocumentLanguage(lang: Language): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
  }
}

/** Đổi ngôn ngữ: lưu vào localStorage (bỏ qua lỗi storage), áp lên tài liệu và báo cho các listener. */
export function setLanguage(next: Language): void {
  const normalized = normalizeLanguage(next);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // Bỏ qua lỗi lưu trữ trong các môi trường bị hạn chế
    }
  }
  applyDocumentLanguage(normalized);
  listeners.forEach((listener) => listener());
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('scms:language-changed', { detail: { lang: normalized } }));
  }
}

/** Đăng ký listener nhận thay đổi ngôn ngữ (cả từ tab khác qua sự kiện storage); trả về hàm hủy đăng ký. */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    // Tab khác đổi ngôn ngữ thì áp lại lên tài liệu và báo listener.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === LANGUAGE_STORAGE_KEY) {
        applyDocumentLanguage(getLanguage());
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Hook React trả về ngôn ngữ hiện tại cùng hàm đổi và đảo ngôn ngữ; tự đồng bộ thuộc tính lang của tài liệu. */
export function useLanguage() {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'vi' as Language);

  useEffect(() => {
    applyDocumentLanguage(lang);
  }, [lang]);

  // Đảo giữa tiếng Việt và tiếng Anh.
  const toggleLanguage = () => {
    setLanguage(lang === 'vi' ? 'en' : 'vi');
  };

  return {
    lang,
    setLanguage,
    toggleLanguage,
  };
}

/**
 * Hook dịch cho giao diện: trả về ngôn ngữ và hàm t() nhận chuỗi, Error hoặc cặp vi/en; không có bản dịch rõ
 * ràng thì tra bảng nhãn.
 */
export function useI18n() {
  const { lang, setLanguage: updateLanguage, toggleLanguage } = useLanguage();

  // Dịch một thông điệp: Error và cặp vi/en dùng bản dịch đi kèm, nếu không thì dùng enText hoặc tra bảng.
  const t = useCallback((viText: string | Error | SourceMessage, enText?: string): string => {
    if (viText instanceof Error) {
      const translation = (viText as Error & { translation?: SourceMessage }).translation;
      return translation ? (lang === 'en' ? translation.en : translation.vi) : viText.message;
    }
    if (typeof viText !== 'string') return lang === 'en' ? viText.en : viText.vi;
    // Cặp chuỗi truyền tường minh tự giữ khoảng trắng của nó; tra bảng nhãn sẽ giữ nguyên ranh giới khoảng trắng nguồn.
    if (enText !== undefined) return lang === 'en' ? enText : viText;
    return translateSource(viText, undefined, lang);
  }, [lang]);

  return {
    lang,
    setLanguage: updateLanguage,
    toggleLanguage,
    t,
  };
}

// Chỉ dùng để tương thích ngược cho các màn hình cũ chưa chuyển đổi. Giao diện mới dịch trực tiếp trong lúc React render.
const VI_TO_EN_PHRASES: ReadonlyArray< readonly [string, string] > = [
  ['Trang chủ', 'Home'],
  ['Khám phá', 'Explore'],
  ['Gói tập', 'Memberships'],
  ['Lớp học & Huấn luyện viên', 'Classes & Coaches'],
  ['Câu hỏi thường gặp', 'FAQ'],
  ['Liên hệ', 'Contact'],
  ['Bảng điều khiển', 'Dashboard'],
  ['Vào bảng điều khiển', 'Go to dashboard'],
  ['Đăng nhập', 'Sign in'],
  ['Đăng ký', 'Register'],
  ['Đăng ký ngay', 'Join now'],
  ['Đăng xuất', 'Sign out'],
  ['Hồ sơ cá nhân', 'My profile'],
  ['Hồ sơ', 'Profile'],
  ['Lịch tập', 'Schedule'],
  ['Huấn luyện', 'Training'],
  ['Chỉ số cơ thể', 'Body metrics'],
  ['Trợ lý AI', 'AI assistant'],
  ['Tin nhắn', 'Messages'],
  ['Thông báo', 'Notifications'],
  ['Hỗ trợ', 'Support'],
  ['Hóa đơn', 'Invoices'],
  ['Lịch dạy', 'Teaching schedule'],
  ['Học viên', 'Members'],
  ['Giáo án', 'Training plans'],
  ['Đánh giá', 'Reviews'],
  ['Đơn nội bộ', 'Internal requests'],
  ['Quầy lễ tân', 'Front desk'],
  ['Điểm danh', 'Attendance'],
  ['Khách tập thử', 'Trial guests'],
  ['Hội viên', 'Members'],
  ['Nhân sự', 'Staff'],
  ['Phân công HLV', 'Coach assignments'],
  ['Lớp học', 'Classes'],
  ['Phòng tập', 'Rooms'],
  ['Thiết bị', 'Equipment'],
  ['Bộ môn', 'Disciplines'],
  ['Báo cáo', 'Reports'],
  ['Nhật ký', 'Audit logs'],
  ['Tài khoản', 'Accounts'],
  ['Vai trò', 'Roles'],
  ['Cấu hình', 'Configuration'],
  ['Đang tải dữ liệu...', 'Loading data...'],
  ['Đang tải...', 'Loading...'],
  ['Lưu thay đổi', 'Save changes'],
  ['Hủy bỏ', 'Cancel'],
  ['Xác nhận', 'Confirm'],
  ['Đóng', 'Close'],
  ['Tìm kiếm', 'Search'],
  ['Làm mới', 'Refresh'],
  ['Xem chi tiết', 'View details'],
  ['Xem tất cả', 'View all'],
  ['Hoạt động', 'Active'],
  ['Đang hoạt động', 'Active'],
  ['Tạm ngưng', 'Paused'],
  ['Đã hủy', 'Cancelled'],
  ['Đã hoàn thành', 'Completed'],
  ['Chờ duyệt', 'Pending'],
  ['Chờ thanh toán', 'Pending payment'],
];

const VI_TO_EN_MAP = new Map<string, string>(VI_TO_EN_PHRASES);

const originalTextMap = new WeakMap<Text, string>();

/** Duyệt các node chữ trong một vùng DOM và đổi cụm tiếng Việt sang tiếng Anh (chỉ để tương thích màn cũ). */
function translateDomSubtree(root: ParentNode, lang: Language): void {
  if (typeof document === 'undefined' || typeof NodeFilter === 'undefined') {
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;
  while (current) {
    const parentTag = current.parentElement?.tagName;
    if (!current.parentElement?.closest('[data-i18n-managed]') && parentTag !== 'SCRIPT' && parentTag !== 'STYLE' && parentTag !== 'TEXTAREA') {
      const raw = current.nodeValue ?? '';
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        if (lang === 'en') {
          const mappedEn = VI_TO_EN_MAP.get(trimmed);
          if (mappedEn) {
            if (!originalTextMap.has(current)) {
              originalTextMap.set(current, raw);
            }
            current.nodeValue = raw.replace(trimmed, mappedEn);
          }
        } else {
          const original = originalTextMap.get(current);
          if (original !== undefined) {
            current.nodeValue = original;
            originalTextMap.delete(current);
          }
        }
      }
    }
    current = walker.nextNode() as Text | null;
  }
}

/**
 * Hook tự dịch DOM sang tiếng Anh và theo dõi thay đổi bằng MutationObserver khi đang ở bản tiếng Anh (chỉ để
 * tương thích màn cũ).
 */
export function useDomLanguageSync(containerRef?: RefObject<HTMLElement | null>): void {
  const { lang } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const target = containerRef?.current ?? document.body;
    if (!target) {
      return;
    }
    translateDomSubtree(target, lang);

    if (lang !== 'en' || typeof MutationObserver === 'undefined') {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateDomSubtree(node as Element, 'en');
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            translateDomSubtree(node.parentElement, 'en');
          }
        });
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [lang, containerRef]);
}

/** Cặp thông điệp song ngữ: bản tiếng Việt và tiếng Anh. */
export interface SourceMessage { vi: string; en: string }
/**
 * Tạo cặp thông điệp song ngữ có nguồn gốc rõ ràng cho thông báo thuộc mã nguồn (không truyền bản tiếng Anh thì tra
 * bảng nhãn); tuyệt đối không suy diễn bản dịch từ nội dung API.
 */
export function sourceMessage(vi: string, en?: string): SourceMessage {
  return { vi, en: en ?? translateSource(vi, undefined, 'en') };
}

/** Ghi nhận các bản dịch thuộc mã nguồn bị thiếu để QA quan sát được thay vì âm thầm giữ nguyên như tiếng Anh. */
const missingTranslations = new Set<string>();
/** Danh sách chuỗi chưa có bản dịch tiếng Anh, để QA kiểm tra. */
export const getMissingTranslations = (): readonly string[] => [...missingTranslations];
/** Xóa danh sách chuỗi thiếu bản dịch. */
export const clearMissingTranslations = () => missingTranslations.clear();

/**
 * Dịch chuỗi thuộc mã nguồn sang tiếng Anh; chuỗi thiếu bản dịch được ghi nhận (và cảnh báo khi chạy dev).
 * Chỉ gọi cho văn bản thuộc mã nguồn; nội dung từ API và dữ liệu người dùng nhập phải giữ nguyên văn.
 */
export function translateSource(vi: string, en?: string, lang: Language = getLanguage()): string {
  const key = vi.trim();
  const translated = en ?? (Object.hasOwn(englishLabels, key) ? englishLabels[key] : undefined);
  if (lang === 'en' && translated === undefined && /[\u00c0-\u1ef9\u0110\u0111]/u.test(key)) {
    if (!missingTranslations.has(key)) {
      missingTranslations.add(key);
      if (import.meta.env.DEV) console.warn('[i18n] Missing English UI translation:', key);
    }
  }
  return lang === 'en' && translated !== undefined ? vi.replace(key, translated) : vi;
}
export const getIntlLocale = (lang: Language = getLanguage()) => lang === 'en' ? 'en-GB' : 'vi-VN';
