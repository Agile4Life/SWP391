import { getIntlLocale, getLanguage } from '../../shared/i18n';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import type { MembershipPackage } from '../member/membershipApi';
// DTO lịch còn nằm trong catalog dùng chung của backend; Public không hiển thị hay đăng ký lớp.
interface PublicClassSession {
  id: number; classId: number; className: string; disciplineId: number;
  disciplineName: string; coachId: number; coachName: string; roomId: number;
  roomName: string; sessionDate: string; startTime: string; endTime: string;
  status: string; cancelReason: string | null; capacity: number; bookedCount: number;
}

/** Thông tin công khai của một HLV: tên, chuyên môn, giới thiệu, chứng chỉ và ảnh. */
export interface PublicCoach {
  id: number; name: string; specialization: string | null; bio: string | null;
  certification: string | null; avatarUrl: string | null;
}
/** Danh mục công khai: gói tập, HLV và buổi học. */
export interface PublicCatalog {
  packages: MembershipPackage[];
  coaches: PublicCoach[];
  sessions: PublicClassSession[];
}

/**
 * Hook tải danh mục công khai từ /public/catalog (không dùng dữ liệu mẫu): tự tải lại mỗi 60 giây, khi tab hiện
 * lại hoặc lấy lại focus, hủy request khi rời trang, và có hàm retry.
 */
export function usePublicCatalog() {
  // State riêng cho dữ liệu, lỗi và lần thử lại; không thay catalog bằng dữ liệu mẫu.
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Thử tải lại bằng cách tăng số lần thử.
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let sequence = 0;
    // Tải catalog; chỉ kết quả của lần gọi mới nhất được dùng, lỗi thì xóa dữ liệu cũ để UI báo lỗi.
    const load = async () => {
      const request = ++sequence;
      setError(false);
      try {
        // Gọi catalog công khai, giữ giá/gói từ server và hủy request khi unmount.
        const data = await apiFetch<PublicCatalog>('/public/catalog', {
          cache: 'no-store', signal: controller.signal, headers: { Authorization: '' },
        });
        if (active && request === sequence) {
          setCatalog({
            packages: Array.isArray(data?.packages) ? data.packages : [],
            coaches: Array.isArray(data?.coaches) ? data.coaches : [],
            sessions: Array.isArray(data?.sessions) ? data.sessions : [],
          });
          setError(false);
        }
      } catch {
        // Không hiển thị giá/lịch cũ khi tải lại lỗi; UI dùng error và retry để thông báo.
        if (active && request === sequence) { setError(true); setCatalog(null); }
      }
    };
    void load();
    // Tải lại khi tab đang hiển thị.
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt]);
  return { catalog, error, retry };
}

/** Định dạng ngày buổi học theo ngôn ngữ hiện tại (thứ, ngày/tháng); chuỗi sai thì giữ nguyên. */
export function sessionDate(value: string) {
  const [year, month, day] = (value || '').split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(getIntlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });
}

const SEEDED_CATALOG_TEXT_EN: Readonly<Record<string, string>> = {
  'Gym - Sức mạnh': 'Gym - Strength',
  'Yoga & Phục hồi': 'Yoga & Recovery',
  'Phòng Gym Tiêu chuẩn': 'Standard Gym Floor',
  'Phòng Gym VIP': 'VIP Platinum Gym',
  'Ring Arena 01': 'Ring Arena 01',
  'Zen Garden Studio': 'Zen Garden Studio',
  'Full Body Strength 101': 'Full Body Strength 101',
  'Yoga Cơ Bản (khóa mới)': 'Beginner Yoga (New Course)',
  'Hatha Yoga Nền Tảng': 'Foundational Hatha Yoga',
  'Boxing Cơ Bản': 'Foundational Boxing',
  '8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.':
    '8 years of strength coaching, muscle building, and fat loss for members of all levels.',
  'Giáo viên Yoga 6 năm kinh nghiệm, tập trung hơi thở, thăng bằng và phục hồi.':
    'Yoga instructor with 6 years of experience focusing on breathwork, balance, and recovery.',
  'Huấn luyện viên Yoga & Phục hồi 7 năm kinh nghiệm: hơi thở, giãn cơ và phục hồi thể lực.':
    'Yoga & Recovery coach with 7 years of experience in breathwork, stretching, and physical recovery.',
  'Cựu vận động viên Boxing, chuyên kỹ thuật đấm và thể lực theo hiệp.':
    'Former competitive boxer specializing in striking technique and round-based conditioning.',
  'Cựu vận động viên Boxing, chuyên kỹ thuật đấm, di chuyển chân và thể lực.':
    'Former competitive boxer specializing in striking technique, footwork, and conditioning.',
};

/**
 * Dịch sang tiếng Anh các tên/mô tả của dữ liệu mẫu trong catalog khi đang ở bản tiếng Anh; chuỗi khác giữ
 * nguyên.
 */
export function localizeSeededCatalogText(
  value: string | null | undefined,
  lang: 'vi' | 'en' = getLanguage(),
): string {
  if (!value) return '';
  if (lang !== 'en') return value;
  return SEEDED_CATALOG_TEXT_EN[value.trim()] ?? value;
}
