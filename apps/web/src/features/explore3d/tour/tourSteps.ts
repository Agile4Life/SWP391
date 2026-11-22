import type { BilingualText, LevelCode } from '../scene/schema';

export interface TourStep {
  id: string;
  nodeId: string;
  level: LevelCode | 'ALL';
  durationMs: number;
  title: BilingualText;
  caption: BilingualText;
  ctaTo: string;
  ctaLabel: BilingualText;
}

// Tour chỉ đi qua Gym tiêu chuẩn và các điểm hỗ trợ check-in/PT.
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'tour-step-1-overview',
    nodeId: 'site-sol',
    level: 'ALL',
    durationMs: 8000,
    title: {
      vi: 'Tổ hợp SÖL Fitness & Wellness',
      en: 'SÖL Fitness & Wellness Center Overview',
    },
    caption: {
      vi: 'Khám phá Gym tiêu chuẩn, quầy lễ tân, cổng QR và studio huấn luyện cá nhân.',
      en: 'Explore the standard Gym, reception, QR gate and personal training studio.',
    },
    ctaTo: '/member/dashboard',
    ctaLabel: {
      vi: 'Mở Bảng điều khiển',
      en: 'Open Dashboard',
    },
  },
  {
    id: 'tour-step-2-l1-lobby',
    nodeId: 'zone-l1-lobby',
    level: 'L1',
    durationMs: 11000,
    title: {
      vi: 'Tầng 1 · Quầy Lễ tân, Cổng QR & Thẻ Hội viên',
      en: 'L1 · Main Lobby, Reception & QR Gate',
    },
    caption: {
      vi: 'Đón tiếp hội viên, kích hoạt Thẻ hội viên điện tử, quét QR qua cổng tự động để ghi nhận chuỗi ngày tập (Streak) và tra cứu hóa đơn.',
      en: 'Member welcome desk, digital Member Card issuance, automated QR check-in gates recording daily workout streaks and billing kiosks.',
    },
    ctaTo: '/member/check-in',
    ctaLabel: {
      vi: 'Mở QR Check-in',
      en: 'Open QR Check-in',
    },
  },
  {
    id: 'tour-step-3-l1-gym',
    nodeId: 'zone-l1-gym',
    level: 'L1',
    durationMs: 13000,
    title: {
      vi: 'Tầng 1 · Phòng Gym Tiêu chuẩn',
      en: 'L1 · Standard Gym Arena',
    },
    caption: {
      vi: 'Khu Gym tiêu chuẩn với máy Cardio, Smith Machine và Squat Rack kết nối trạng thái trực tiếp.',
      en: 'Standard Gym with live equipment status, cardio stations, Smith machines and squat racks.',
    },
    ctaTo: '/member/packages',
    ctaLabel: {
      vi: 'Xem gói tập',
      en: 'View memberships',
    },
  },
  {
    id: 'tour-step-6-l2-vip-gym',
    nodeId: 'zone-l2-pt-studio',
    level: 'L2',
    durationMs: 13000,
    title: {
      vi: 'Tầng 2 · Studio huấn luyện cá nhân',
      en: 'L2 · Personal training studio',
    },
    caption: {
      vi: 'Không gian tập luyện cùng huấn luyện viên cá nhân theo lịch PT 1:1.',
      en: 'Personal training space for scheduled 1:1 coaching sessions.',
    },
    ctaTo: '/member/classes?tab=pt',
    ctaLabel: {
      vi: 'Đặt lịch PT 1:1',
      en: 'Book 1:1 PT',
    },
  },
] as const;

export const TOTAL_TOUR_DURATION_MS = TOUR_STEPS.reduce(
  (sum, step) => sum + step.durationMs,
  0,
);
