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
      vi: 'Toàn cảnh mô hình 5 phân tầng kiến trúc: Tầng hầm Oasis (B1), Tầng 1, Tầng 2 VIP, Penthouse Zen Garden (RF) và Sân Tennis ngoài trời.',
      en: 'Panoramic view across 5 architectural tiers: B1 Oasis Sub-level, L1 Training Arena, L2 VIP Platinum, RF Zen Garden Penthouse and Outdoor Tennis.',
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
      vi: 'Tầng 1 · Phòng Gym Tiêu chuẩn & Võ đài Ring Arena 01',
      en: 'L1 · Standard Gym Arena & Boxing Ring',
    },
    caption: {
      vi: 'Sàn tập 384m² với 29 máy Cardio, Smith Machine, Squat Rack kết nối trạng thái thiết bị trực tiếp cùng đài đấu Boxing tiêu chuẩn.',
      en: '384m² strength & cardio floor featuring 29 live-monitored stations, Smith machines, squat racks and the Ring Arena 01 boxing studio.',
    },
    ctaTo: '/member/classes?discipline=Gym',
    ctaLabel: {
      vi: 'Xem Lịch lớp Gym & Boxing',
      en: 'View Gym & Boxing Schedule',
    },
  },
  {
    id: 'tour-step-4-l1-badminton',
    nodeId: 'zone-l1-badminton',
    level: 'L1',
    durationMs: 11000,
    title: {
      vi: 'Tầng 1 · Cụm 4 Sân Cầu lông & Kệ Thực phẩm bổ sung',
      en: 'L1 · Badminton Courts 01–04 & Supplement Shop',
    },
    caption: {
      vi: 'Bốn sân cầu lông thảm thi đấu đặt lịch trực tuyến theo khung 60 phút, liền kề khu trưng bày thực phẩm bổ sung SÖL Fuel.',
      en: 'Four tournament-grade indoor badminton courts bookable in 60-minute slots alongside the SÖL Fuel supplement retail counter.',
    },
    ctaTo: '/member/courts?sport=C%E1%BA%A7u%20l%C3%B4ng',
    ctaLabel: {
      vi: 'Đặt Sân Cầu lông',
      en: 'Book Badminton Court',
    },
  },
  {
    id: 'tour-step-5-b1-pool',
    nodeId: 'zone-b1-pool',
    level: 'B1',
    durationMs: 12000,
    title: {
      vi: 'Tầng hầm B1 · Hồ bơi Oasis 25m & Khu Xông hơi Thermal',
      en: 'B1 · Oasis 25m Lap Pool & Thermal Spa',
    },
    caption: {
      vi: 'Hồ bơi nước ấm phân 2 làn tiêu chuẩn 25m kết hợp phòng xông hơi đá muối, Jacuzzi thủy trị liệu và hệ thống tủ khóa thông minh.',
      en: 'Heated 25m two-lane lap pool paired with Himalayan salt sauna, hydro-recovery Jacuzzi and smart RFID locker rooms.',
    },
    ctaTo: '/member/courts?sport=B%C6%A1i%20l%E1%BB%99i',
    ctaLabel: {
      vi: 'Đặt Làn bơi Oasis',
      en: 'Book Swim Lane',
    },
  },
  {
    id: 'tour-step-6-l2-vip-gym',
    nodeId: 'zone-l2-vip-gym',
    level: 'L2',
    durationMs: 13000,
    title: {
      vi: 'Tầng 2 · Phòng Gym VIP Platinum & Phân tích InBody 770',
      en: 'L2 · VIP Platinum Gym & InBody 770 Lab',
    },
    caption: {
      vi: 'Không gian đặc quyền hội viên Platinum với dàn máy Technogym Artis, Kinesis One, buồng đo chỉ số cơ thể InBody 770 và Studio HLV 1:1.',
      en: 'Exclusive Platinum sanctuary featuring Technogym Artis stations, Kinesis One, the InBody 770 diagnostic lab and 1:1 PT coaching studio.',
    },
    ctaTo: '/member/progress',
    ctaLabel: {
      vi: 'Xem Tiến độ & InBody',
      en: 'Open Progress & InBody',
    },
  },
  {
    id: 'tour-step-7-rf-zen',
    nodeId: 'zone-rf-zen',
    level: 'RF',
    durationMs: 11000,
    title: {
      vi: 'Tầng thượng RF · Penthouse Zen Garden Yoga Studio',
      en: 'RF · Penthouse Zen Garden Yoga Studio',
    },
    caption: {
      vi: 'Studio Yoga sàn chiếu Tatami ngập ánh sáng tự nhiên trên tầng thượng, bao quanh bởi vườn thiền ngoài trời thoáng đãng.',
      en: 'Skylit tatami yoga and mindfulness studio on the penthouse level, framed by a landscaped sky deck.',
    },
    ctaTo: '/member/classes?discipline=Yoga',
    ctaLabel: {
      vi: 'Đặt lớp Yoga',
      en: 'Book Yoga Class',
    },
  },
  {
    id: 'tour-step-8-out-tennis',
    nodeId: 'zone-out-tennis',
    level: 'OUT',
    durationMs: 11000,
    title: {
      vi: 'Ngoài trời · Cụm Sân Tennis 01 & 02',
      en: 'OUT · Outdoor Tennis Courts 01 & 02',
    },
    caption: {
      vi: 'Hai sân Tennis mặt cứng Acrylic giảm chấn tiêu chuẩn thi đấu ngoài trời, sẵn sàng đặt lịch trực tuyến từ 06:00 đến 22:00.',
      en: 'Two cushioned acrylic outdoor championship tennis courts available for hourly booking from 06:00 to 22:00.',
    },
    ctaTo: '/member/courts?sport=Tennis',
    ctaLabel: {
      vi: 'Đặt Sân Tennis',
      en: 'Book Tennis Court',
    },
  },
] as const;

export const TOTAL_TOUR_DURATION_MS = TOUR_STEPS.reduce(
  (sum, step) => sum + step.durationMs,
  0,
);
