import { getIntlLocale, getLanguage } from '../../shared/i18n';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import type { MembershipPackage } from '../member/membershipApi';
import type { ClassSessionDto } from '../member/memberClassesApi';

export interface PublicCoach {
  id: number; name: string; specialization: string | null; bio: string | null;
  certification: string | null; avatarUrl: string | null;
}
export interface PublicCatalog {
  packages: MembershipPackage[];
  coaches: PublicCoach[];
  sessions: ClassSessionDto[];
}

export function usePublicCatalog() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      setError(false);
      try {
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
        // Hide stale prices and schedules when refresh fails.
        if (active && request === sequence) { setError(true); setCatalog(null); }
      }
    };
    void load();
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

export function sessionDate(value: string) {
  const [year, month, day] = (value || '').split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(getIntlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });
}

const SEEDED_CATALOG_TEXT_EN: Readonly<Record<string, string>> = {
  'Gym - Sức mạnh': 'Gym - Strength',
  'Bơi lội': 'Swimming',
  'Cầu lông': 'Badminton',
  'Phòng Gym Tiêu chuẩn': 'Standard Gym Floor',
  'Phòng Gym VIP': 'VIP Platinum Gym',
  'Yoga Cơ Bản (khóa mới)': 'Beginner Yoga (New Course)',
  '8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.':
    '8 years of strength coaching, muscle building, and fat loss for members of all levels.',
  'Giáo viên Yoga 6 năm kinh nghiệm, tập trung hơi thở, thăng bằng và phục hồi.':
    'Yoga instructor with 6 years of experience focusing on breathwork, balance, and recovery.',
  'Cựu vận động viên Boxing, chuyên kỹ thuật đấm và thể lực theo hiệp.':
    'Former competitive boxer specializing in striking technique and round-based conditioning.',
  'Huấn luyện viên bơi 7 năm kinh nghiệm: kỹ thuật bơi và sức bền dưới nước.':
    'Swimming coach with 7 years of experience in stroke technique and aquatic endurance.',
};

export function localizeSeededCatalogText(
  value: string | null | undefined,
  lang: 'vi' | 'en' = getLanguage(),
): string {
  if (!value) return '';
  if (lang !== 'en') return value;
  return SEEDED_CATALOG_TEXT_EN[value.trim()] ?? value;
}
