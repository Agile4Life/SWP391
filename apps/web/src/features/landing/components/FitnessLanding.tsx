import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../../shared/api/client';
import { trainerProfiles } from '../data/trainersData';
import { RoundArrow } from './PublicLayout';

const tickerItems = [
  'STRENGTH FLOOR',
  'LAP POOL 25M',
  'TENNIS COURTS',
  'MOVEMENT STUDIO',
  'FREE WEIGHTS',
  'HYDRO-RECOVERY',
  'BARBELL CLUB',
  'MULTI-SPORT PASS',
];

const manifestoWords = 'Mạnh mẽ trong phòng tạ. Nhẹ nhàng dưới làn nước. Linh hoạt trên sân đấu.'.split(' ');

const services = [
  { title: 'WeightLifting', description: 'Tập tạ đúng kỹ thuật, tăng sức mạnh nền tảng.', icon: 'weights' },
  { title: 'Private Training', description: 'Huấn luyện 1:1 theo nhịp độ riêng.', icon: 'training' },
  { title: 'Build Muscle', description: 'Phát triển cơ bắp săn chắc, cân đối.', icon: 'muscle' },
];
const serviceShapes = [
  'M37 30L259 0Q290-2 295 32L319 231Q323 280 279 280H72Q33 280 27 241L1 80Q-5 40 37 30Z',
  'M42 0H278Q322 0 316 44L294 242Q290 280 251 280H69Q30 280 26 242L4 44Q-2 0 42 0Z',
  'M61 0L283 30Q325 40 319 80L293 241Q287 280 248 280H41Q-3 280 1 231L25 32Q30-2 61 0Z',
];
const clubMetrics = [
  { value: '06:00 — 22:00', countTo: 22, format: (n: number) => `06:00 — ${String(n).padStart(2, '0')}:00`, label: 'MỞ CỬA MỖI NGÀY' },
  { value: '05 Zones', countTo: 5, format: (n: number) => `${String(n).padStart(2, '0')} Zones`, label: 'TỔ HỢP ĐA BỘ MÔN' },
  { value: 'Lịch lớp', label: 'ĐẶT CHỖ TRỰC TUYẾN' },
  { value: 'QR Pass', label: '01 THẺ ĐA PHÂN KHU' },
];
const muscleGroups = [
  {
    id: 'chest',
    name: 'Cơ Ngực (Pectorals)',
    zone: 'UPPER & MID CHEST',
    goal: 'Tăng độ dày & đường nét khung ngực',
    tip: 'Hạ tạ có kiểm soát 2–3 giây và khép bả vai để giảm tải khớp vai trước.',
    exercises: [
      'Incline Dumbbell Press · 4 hiệp × 8–10 lần',
      'Cable Chest Fly · 3 hiệp × 12 lần',
    ],
    side: 'right' as const,
    origin: { x: 655, y: 485 },
    elbow: { x: 875, y: 980 },
    tipPoint: { x: 1015, y: 980 },
    calloutTop: '64%',
    paths: [
      'M 455 395 C 495 375, 550 385, 580 420 C 615 385, 680 380, 725 415 C 742 475, 720 565, 650 585 C 610 592, 588 570, 576 550 C 562 575, 522 595, 472 582 C 442 560, 438 465, 455 395 Z',
    ],
  },
  {
    id: 'shoulders',
    name: 'Cơ Vai & Cầu Vai (Deltoids & Traps)',
    zone: 'DELTOIDS & TRAPS',
    goal: 'Mở rộng khung vai & ổn định khớp bả vai',
    tip: 'Đẩy tạ trong mặt phẳng xương bả vai (góc 30°) để bảo vệ khớp xoay vai.',
    exercises: [
      'Seated Dumbbell Overhead Press · 4 hiệp × 8–10 lần',
      'Lateral Raise & Face Pull · 4 hiệp × 12–15 lần',
    ],
    side: 'left' as const,
    origin: { x: 355, y: 415 },
    elbow: { x: 165, y: 325 },
    tipPoint: { x: 10, y: 325 },
    calloutTop: '22%',
    paths: [
      'M 485 288 C 430 305, 365 348, 325 405 C 305 445, 308 495, 325 522 C 375 532, 425 510, 445 455 C 455 410, 472 365, 495 345 Z',
      'M 635 295 C 695 315, 765 345, 815 405 C 838 445, 840 495, 822 522 C 782 528, 745 505, 725 445 C 705 395, 672 365, 630 348 Z',
    ],
  },
  {
    id: 'arms',
    name: 'Bắp Tay Trước & Tay Sau (Biceps & Triceps)',
    zone: 'BICEPS & TRICEPS',
    goal: 'Phát triển lực kéo – đẩy đối xứng',
    tip: 'Cố định khuỷu tay sát thân người khi cuộn tạ hoặc kéo cáp.',
    exercises: [
      'Incline Dumbbell Curl · 3 hiệp × 10–12 lần',
      'Rope Triceps Pushdown · 4 hiệp × 12 lần',
    ],
    side: 'left' as const,
    origin: { x: 335, y: 595 },
    elbow: { x: 155, y: 525 },
    tipPoint: { x: 10, y: 525 },
    calloutTop: '35%',
    paths: [
      'M 315 505 C 365 518, 422 518, 442 565 C 450 625, 442 685, 425 718 C 368 722, 312 695, 300 625 C 292 575, 298 532, 315 505 Z',
      'M 748 505 C 795 495, 848 515, 875 575 C 895 620, 888 668, 855 685 C 805 685, 768 645, 745 585 Z',
    ],
  },
  {
    id: 'core',
    name: 'Cơ Bụng & Liên Sườn (Core & Obliques)',
    zone: 'ABS & OBLIQUES',
    goal: 'Siết cơ trọng tâm & truyền lực xoay',
    tip: 'Thở ra nén chặt thành bụng, tránh võng thắt lưng.',
    exercises: [
      'Hanging Knee Raise · 3 hiệp × 12 lần',
      'Cable Pallof Press & Plank · 3 hiệp × 45 giây',
    ],
    side: 'right' as const,
    origin: { x: 615, y: 665 },
    elbow: { x: 875, y: 1030 },
    tipPoint: { x: 1015, y: 1030 },
    calloutTop: '67%',
    paths: [
      'M 455 575 C 515 595, 625 595, 692 572 C 685 645, 670 725, 655 772 C 595 785, 505 785, 440 765 C 435 705, 442 635, 455 575 Z',
    ],
  },
  {
    id: 'forearms',
    name: 'Cẳng Tay & Lực Nắm (Forearms & Grip)',
    zone: 'FOREARMS & GRIP',
    goal: 'Tăng lực cầm tạ & ổn định cổ tay khi cầm vợt',
    tip: 'Giữ cổ tay thẳng trục với cẳng tay trong mọi bài kéo và đánh bóng.',
    exercises: [
      'Farmer’s Walk · 3 hiệp × 40m',
      'Reverse Curl & Dead Hang · 3 hiệp × 40 giây',
    ],
    side: 'left' as const,
    origin: { x: 355, y: 835 },
    elbow: { x: 165, y: 760 },
    tipPoint: { x: 10, y: 760 },
    calloutTop: '50%',
    paths: [
      'M 312 695 C 365 705, 422 715, 432 775 C 425 895, 422 1015, 442 1115 C 425 1162, 365 1165, 345 1115 C 338 985, 315 835, 312 695 Z',
      'M 815 655 C 868 655, 902 688, 892 735 C 845 795, 785 845, 725 905 C 675 912, 642 885, 655 835 C 705 765, 765 705, 815 655 Z',
    ],
  },
  {
    id: 'legs',
    name: 'Cơ Đùi & Bắp Chân (Quads & Calves)',
    zone: 'QUADS & CALVES',
    goal: 'Sức mạnh thân dưới & tốc độ bứt tốc trên sân',
    tip: 'Mở hướng đầu gối theo mũi chân và kiểm soát nhịp gập hông – gối.',
    exercises: [
      'Barbell / Goblet Squat · 4 hiệp × 8–10 lần',
      'Bulgarian Split Squat & Calf Raise · 3 hiệp × 12 lần',
    ],
    side: 'right' as const,
    origin: { x: 885, y: 925 },
    elbow: { x: 955, y: 1060 },
    tipPoint: { x: 1015, y: 1060 },
    calloutTop: '69%',
    paths: [
      'M 315 780 C 235 765, 155 805, 132 895 C 105 1015, 118 1175, 162 1340 L 245 1340 C 268 1195, 278 1055, 248 945 C 295 925, 322 865, 315 780 Z',
      'M 765 795 C 845 775, 925 805, 948 895 C 972 1015, 958 1175, 915 1340 L 832 1340 C 808 1195, 798 1055, 825 945 C 782 925, 758 865, 765 795 Z',
    ],
  },
] as const;

const trainers = trainerProfiles;
const stories = [
  { slug: 'strength-coach', name: 'Derek', image: 'coach-strength.png', quote: 'Kỷ luật bắt đầu từ việc có mặt. Mỗi ngày, thêm một chút tiến bộ.', focus: 'STRENGTH COACH', meta: '6 năm kinh nghiệm · Strength Floor' },
  { slug: 'aquatics-coach', name: 'Anthony', image: 'trainer-strength.jpg', quote: 'Tôi tìm được nhịp tập phù hợp dưới nước và giúp học viên lướt nhẹ mà không tốn sức.', focus: 'AQUATICS COACH', meta: '8 năm kinh nghiệm · Hồ bơi 25m' },
  { slug: 'personal-coach', name: 'Jhon', image: 'strength-session.jpg', quote: 'Không chỉ là thay đổi vóc dáng. Tôi muốn bạn thấy khỏe và tự tin hơn mỗi tuần.', focus: 'PERSONAL COACH', meta: '7 năm kinh nghiệm · Kèm 1:1 Đa môn' },
  { slug: 'tennis-coach', name: 'Ezekiel', image: 'hero-athlete.png', quote: 'Có người đồng hành chỉnh từng bước chân giúp bạn tự tin trong mọi đường bóng.', focus: 'TENNIS COACH', meta: '7 năm kinh nghiệm · Sân Tennis' },
];

const dailyRhythmItems = [
  {
    id: 'morning' as const,
    label: 'Sáng · 06:00–09:00',
    title: 'Khởi động thể lực sáng sớm',
    crowdLoad: '45%',
    crowdText: 'Thông thoáng',
    highlights: ['Morning Strength', 'Bơi sáng', 'Tennis'],
  },
  {
    id: 'midday' as const,
    label: 'Trưa · 11:30–14:00',
    title: 'Tập gọn 45 phút giờ nghỉ trưa',
    crowdLoad: '38%',
    crowdText: 'Rất thoáng',
    highlights: ['Kèm 1:1', 'Core & Mobility', 'Thả lỏng'],
  },
  {
    id: 'evening' as const,
    label: 'Chiều · 17:00–19:30',
    title: 'Nhịp tập sôi động sau giờ làm',
    crowdLoad: '74%',
    crowdText: 'Đặt lịch trước trên Portal',
    highlights: ['Barbell Club', 'Lớp Bơi', 'Đánh đôi Tennis'],
  },
  {
    id: 'night' as const,
    label: 'Tối · 19:30–22:00',
    title: 'Vận động nhẹ & Giãn cơ cuối ngày',
    crowdLoad: '52%',
    crowdText: 'Dịu nhẹ, thông thoáng',
    highlights: ['Tập cá nhân', 'Bơi thư giãn', 'Giãn cơ'],
  },
] as const;

const spaces = [
  { title: 'Không gian cho những mục tiêu lớn.', image: '/images/fitness/gym-floor.jpg', label: 'Strength floor', meta: 'Khu máy tập', load: '68%', status: 'Đang thoáng' },
  { title: 'Tập trung vào từng chuyển động.', image: '/images/fitness/strength-session.jpg', label: 'Free weights', meta: 'Khu tạ rời & Power Rack', load: '54%', status: 'Mật độ lý tưởng' },
  { title: 'Tìm lại nhịp điệu của chính mình.', image: '/images/about-movement-studio.jpg', label: 'Movement studio', meta: 'Core & Giãn cơ', load: '42%', status: 'Thoáng đãng' },
  { title: 'Làn nước xanh mát bốn mùa.', image: '/images/fitness/aquatics-pool.jpg', label: 'Aquatics pool', meta: 'Hồ bơi bốn mùa', load: '48%', status: 'Thông thoáng' },
  { title: 'Sân đấu giàu năng lượng.', image: '/images/fitness/tennis-court.jpg', label: 'Tennis courts', meta: 'Sân Tennis CLB', load: '62%', status: 'Sẵn sàng' },
];

const multiSportShowcase = [
  {
    id: 'swimming' as const,
    path: '/swimming',
    kicker: 'AQUATICS CLUB',
    title: 'Hồ Bơi Bốn Mùa',
    image: '/images/fitness/aquatics-pool.jpg',
    tags: ['06 Làn bơi', 'Nước ấm', 'Mọi cấp độ'],
    hoverMeta: 'Lớp nhập môn · Bơi sức bền · Thả lỏng',
    cta: 'Trang Hồ Bơi',
  },
  {
    id: 'tennis' as const,
    path: '/tennis',
    kicker: 'TENNIS CLUB',
    title: 'Sân Tennis Câu Lạc Bộ',
    image: '/images/fitness/tennis-court.jpg',
    tags: ['02 Sân tiêu chuẩn', 'Máy bắn bóng', 'Đánh đôi'],
    hoverMeta: 'Lớp cầm vợt cơ bản · Giao lưu cuối tuần',
    cta: 'Trang Sân Tennis',
  },
] as const;

const scheduleItems = [
  { time: '06:30 — 07:20', title: 'Morning Strength Foundation', category: 'strength', studio: 'Strength floor', coach: 'Derek', level: 'Mọi cấp độ' },
  { time: '07:30 — 08:25', title: 'Aquatics Stroke & Endurance', category: 'conditioning', studio: 'Aquatics pool', coach: 'Anthony', level: 'Cơ bản — Nâng cao' },
  { time: '09:00 — 09:50', title: 'Reformer Core & Mobility', category: 'movement', studio: 'Movement studio', coach: 'Elena', level: 'Mọi cấp độ' },
  { time: '17:30 — 18:25', title: 'Hypertrophy & Barbell Club', category: 'strength', studio: 'Free weights', coach: 'Derek', level: 'Trung bình — Nâng cao' },
  { time: '18:30 — 19:20', title: 'Dynamic Mobility & Recovery', category: 'movement', studio: 'Movement studio', coach: 'Elena', level: 'Mọi cấp độ' },
  { time: '19:30 — 20:30', title: 'Tennis Footwork & Match Play', category: 'conditioning', studio: 'Tennis courts', coach: 'Ezekiel', level: 'Mọi cấp độ' },
];
const journeySteps = [
  { step: '01', title: 'Tạo tài khoản & chọn gói tập', description: 'Đăng ký trực tuyến nhanh gọn.' },
  { step: '02', title: 'Cập nhật chỉ số & mục tiêu', description: 'Nhận gợi ý lộ trình theo BMI.' },
  { step: '03', title: 'Đặt lịch & quét QR check-in', description: 'Giữ chỗ & vào cửa bằng thẻ QR.' },
];
const plans = [
  { period: 'Tháng', name: 'Gói Cơ Bản · 1 Tháng', price: '1.200.000', duration: '30 ngày', perks: ['Khu Gym, Free Weights & Hồ bơi', 'Lớp giãn cơ & bơi cơ bản', 'Thẻ QR check-in điện tử'] },
  { period: 'Quý', name: 'Gói Đa Môn · 3 Tháng', price: '3.100.000', duration: '90 ngày', perks: ['Toàn bộ 05 phân khu & Sân Tennis', 'Lớp kỹ thuật Bơi, Tennis & Core', 'Đặt lịch trực tuyến trên Portal'] },
  { period: 'Năm', name: 'Gói Đồng Hành · 12 Tháng', price: '10.800.000', duration: '365 ngày', perks: ['Không giới hạn 05 phân khu', 'Định hướng cùng Huấn luyện viên', 'Hỗ trợ bảo lưu (Freeze) trực tuyến'] },
];
const faqs = [
  {
    question: 'Người mới bắt đầu có theo kịp không?',
    answer: 'Có. Mỗi bộ môn đều có lớp nhập môn hướng dẫn từ cơ bản.',
  },
  {
    question: 'Gói hội viên đã bao gồm Hồ bơi và Sân Tennis chưa?',
    answer: 'Gói 1 Tháng mở khu Gym & Hồ bơi; Gói 3 Tháng và 12 Tháng mở toàn bộ 05 phân khu gồm cả Sân Tennis.',
  },
  {
    question: 'Tôi có thể tạm dừng (bảo lưu) gói tập khi bận công tác không?',
    answer: 'Có. Bạn gửi yêu cầu bảo lưu (Freeze) trực tiếp trên Portal hội viên.',
  },
  {
    question: 'Làm sao để đặt lớp học hoặc đặt sân?',
    answer: 'Đăng nhập vào Portal để xem chỗ trống và đặt lịch trước.',
  },
];

function SplitHeading({ id, lines }: { id: string; lines: string[] }) {
  let wordIndex = 0;
  return <h2 id={id} className="fit-split-heading">
    {lines.map((line, lineIdx) => {
      const words = line.split(' ');
      return <span key={lineIdx} className="fit-heading-line">
        {words.map((word, idx) => {
          const currentIdx = wordIndex++;
          const isLastWord = lineIdx === lines.length - 1 && idx === words.length - 1;
          return <span key={`${lineIdx}-${idx}`}>
            <span className="fit-word">
              <span style={{ '--word-index': currentIdx } as CSSProperties}>
                {word}{isLastWord && <span className="fit-title-dot">.</span>}
              </span>
            </span>
            {idx < words.length - 1 ? ' ' : ''}
          </span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>;
    })}
  </h2>;
}

function CountUpMetric({ value, countTo, format }: { value: string; countTo: number; format: (n: number) => string }) {
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) {
      setDisplay(value);
      return;
    }
    let rafId = 0;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !preference.matches) {
          cancelAnimationFrame(rafId);
          const start = performance.now();
          const duration = 1200;
          const step = (now: number) => {
            const elapsed = Math.min(1, (now - start) / duration);
            const eased = 1 - ((1 - elapsed) ** 3);
            const current = Math.max(1, Math.round(eased * countTo));
            setDisplay(elapsed >= 1 ? value : format(current));
            if (elapsed < 1) rafId = requestAnimationFrame(step);
          };
          rafId = requestAnimationFrame(step);
        }
      });
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [value, countTo, format]);

  return <strong ref={ref}>{display}</strong>;
}

function ServiceIcon({ type }: { type: string }) {
  return <svg className="fit-service-icon" viewBox="0 0 64 64" fill="none" stroke="#805e50" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'weights' ? <g transform="translate(0 -1.5)">
      <path d="M6 17h52" /><rect x="3" y="10" width="5" height="15" rx="1" fill="#ada59a" /><rect x="10" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="49" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="56" y="10" width="5" height="15" rx="1" fill="#ada59a" />
      <path d="m26 28-6-5V13h5v7l5 4h4l5-4v-7h5v10l-6 5 1 13H25Z" fill="#ebc18c" /><circle cx="32" cy="18" r="6" fill="#ebc18c" /><path d="M27 14c0-5 10-5 10 0" fill="#705648" /><path d="m25 40-2 10 5 1 4-8 4 8 5-1-2-10Z" fill="#e69e87" /><path d="m23 50-1 10h6l1-9m6 0 1 9h6l-1-10" fill="#ebc18c" /><path d="M21 60h8m6 0h8M29 32h6" />
    </g> : type === 'training' ? <g>
      <g transform="rotate(-37 34 23)"><path d="M15 22h36v5H15Z" fill="#e6a08a" /><rect x="10" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="4" y="18" width="6" height="13" rx="1" fill="#e6907e" /><rect x="49" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="56" y="18" width="5" height="13" rx="1" fill="#e6907e" /></g>
      <path d="M14 44h34v5H14Z" fill="#e8d6b9" /><rect x="9" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="3" y="39" width="6" height="15" rx="1" fill="#ded2c1" /><rect x="47" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="54" y="39" width="6" height="15" rx="1" fill="#ded2c1" />
    </g> : <g transform="translate(-2.5 5)">
      <path d="M12 44c-1-10 2-21 7-29l10 4-5 13c8-8 17-6 21-1l7 8 2 10c-12 8-29 7-42-5Z" fill="#e9c59b" /><path d="m19 15 2-9 9 1 4 8-5 4m-8-4 4-4 4 3M32 34c0 6 4 10 9 10m-22 0c3 3 8 4 12 3M47 44l8-3" />
      <circle cx="48" cy="13" r="10" fill="#edc7a5" /><path d="M48 18s-7-4-5-8c1-2 4-2 5 0 2-2 5-2 6 0 2 4-6 8-6 8Z" fill="#df9785" />
    </g>}
  </svg>;
}

const handleCardPointerMove = (event: PointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const px = (((event.clientX - rect.left) / Math.max(1, rect.width)) - 0.5) * -10;
  const py = (((event.clientY - rect.top) / Math.max(1, rect.height)) - 0.5) * -10;
  event.currentTarget.style.setProperty('--fit-px', `${px.toFixed(2)}px`);
  event.currentTarget.style.setProperty('--fit-py', `${py.toFixed(2)}px`);
};

const handleCardPointerLeave = (event: PointerEvent<HTMLElement>) => {
  event.currentTarget.style.setProperty('--fit-px', '0px');
  event.currentTarget.style.setProperty('--fit-py', '0px');
};

export function FitnessLanding() {
  const user = getCurrentUser();
  const joinPath = user ? user.role === 'MEMBER' ? '/member/packages' : homePath(user.role) : '/register';
  const muscleDetailPath = user ? user.role === 'MEMBER' ? '/member/packages' : homePath(user.role) : '/login';
  const [activeMuscleId, setActiveMuscleId] = useState<(typeof muscleGroups)[number]['id'] | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [trainerPage, setTrainerPage] = useState(0);
  const [space, setSpace] = useState(0);
  const [planMode, setPlanMode] = useState<'all' | 'long'>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'strength' | 'movement' | 'conditioning'>('all');
  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('65');
  const [goalType, setGoalType] = useState<'lean' | 'muscle' | 'balance'>('muscle');
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeRhythmIdx, setActiveRhythmIdx] = useState<number>(0);
  const activeRhythm = dailyRhythmItems[activeRhythmIdx];
  const visibleTrainers = trainerPage === 0
    ? trainers.slice(0, 2)
    : trainerPage === 1
      ? trainers.slice(1, 3)
      : trainers.slice(3, 5);

  const activateMuscle = (id: (typeof muscleGroups)[number]['id']) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveMuscleId(id);
  };

  const scheduleClearMuscle = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setActiveMuscleId(null);
      closeTimerRef.current = null;
    }, 180);
  };

  const activeMuscle = muscleGroups.find((group) => group.id === activeMuscleId) ?? null;
  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const validMetrics = parsedHeight >= 100 && parsedHeight <= 240 && parsedWeight >= 30 && parsedWeight <= 250;
  const bmiValue = validMetrics ? +(parsedWeight / ((parsedHeight / 100) ** 2)).toFixed(1) : null;
  const bmiStatus = bmiValue === null
    ? 'Nhập chiều cao & cân nặng hợp lệ'
    : bmiValue < 18.5
      ? 'Cần bổ sung khối cơ & dinh dưỡng'
      : bmiValue < 23
        ? 'Thể trạng cân đối chuẩn châu Á'
        : bmiValue < 25
          ? 'Thừa cân nhẹ — tối ưu đốt mỡ'
          : 'Ưu tiên giảm mỡ & bảo vệ khớp';
  const recommendedPlan = goalType === 'lean'
    ? 'Gói Đa Môn · 3 Tháng'
    : goalType === 'muscle'
      ? 'Gói Đa Môn · 3 Tháng'
      : 'Gói Cơ Bản · 1 Tháng';

  const visibleSchedule = scheduleItems.filter((item) => scheduleFilter === 'all' || item.category === scheduleFilter);

  return <main id="public-main">
    <section className="fit-hero" id="hero" aria-labelledby="hero-title">
      <div className="fit-hero-lines" aria-hidden="true" />
      <h1 id="hero-title" className="fit-hero-title"><span>BUILD YOUR</span><span>BODY SHAPES<span className="fit-title-dot">.</span></span></h1>
      <div className="fit-hero-copy"><p>Mạnh mẽ từ thể chất.<br />Tự tin từ bên trong.</p>
        <a href="#stories" className="fit-reviews"><span>Cùng nhau tiến bộ</span><span className="fit-avatar-row">{stories.slice(0, 3).map((story) => <img key={story.name} src={`/images/fitness/${story.image}`} alt="" />)}<span className="fit-review-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" /></svg></span></span><span className="fit-review-label">Đội ngũ đồng hành</span></a>
      </div>
      <img className="fit-hero-athlete" src="/images/fitness/hero-athlete.png" alt="Vận động viên ngồi tập tạ đơn, hướng ánh nhìn xuống, trên nền tối" fetchPriority="high" />
      <div className="fit-hero-anatomy-stage" onPointerLeave={scheduleClearMuscle}>
        <svg
          className="fit-hero-anatomy"
          viewBox="0 0 1024 1536"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Bản đồ nhóm cơ tương tác trên cơ thể vận động viên"
        >
          <defs>
            <filter id="fit-muscle-feather" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="24" />
            </filter>
            <mask id="fit-active-muscle-mask">
              <rect width="1024" height="1536" fill="black" />
              {activeMuscle && <g filter="url(#fit-muscle-feather)">
                {activeMuscle.paths.map((d, index) => <path key={index} d={d} fill="white" />)}
              </g>}
            </mask>
          </defs>
          {activeMuscle && <image
            href="/images/fitness/hero-athlete.png"
            width="1024"
            height="1536"
            mask="url(#fit-active-muscle-mask)"
            className="fit-muscle-lit-image"
            aria-hidden="true"
          />}
          {muscleGroups.map((group) => {
            const isActive = activeMuscleId === group.id;
            return <g
              key={group.id}
              className={`fit-muscle-zone ${isActive ? 'is-active' : ''}`}
              data-muscle={group.id}
              role="button"
              tabIndex={0}
              aria-label={`Vùng cơ: ${group.name}`}
              aria-pressed={isActive}
              onPointerEnter={() => activateMuscle(group.id)}
              onMouseEnter={() => activateMuscle(group.id)}
              onFocus={() => activateMuscle(group.id)}
              onBlur={scheduleClearMuscle}
              onClick={() => activateMuscle(group.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  activateMuscle(group.id);
                }
              }}
            >
              <title>{group.name} — {group.goal}</title>
              {group.paths.map((d, index) => <path key={index} className="fit-muscle-shape" d={d} />)}
            </g>;
          })}
          {activeMuscle && <g key={activeMuscle.id} className="fit-muscle-pointer" aria-hidden="true">
            <circle className="fit-pointer-origin-ring" cx={activeMuscle.origin.x} cy={activeMuscle.origin.y} r="11" />
            <circle className="fit-pointer-origin-dot" cx={activeMuscle.origin.x} cy={activeMuscle.origin.y} r="4.5" />
            <polyline
              className="fit-pointer-line"
              points={`${activeMuscle.origin.x},${activeMuscle.origin.y} ${activeMuscle.elbow.x},${activeMuscle.elbow.y} ${activeMuscle.tipPoint.x},${activeMuscle.tipPoint.y}`}
            />
            <path
              className="fit-pointer-head"
              d={activeMuscle.side === 'left'
                ? `M ${activeMuscle.tipPoint.x + 15} ${activeMuscle.tipPoint.y - 8} L ${activeMuscle.tipPoint.x} ${activeMuscle.tipPoint.y} L ${activeMuscle.tipPoint.x + 15} ${activeMuscle.tipPoint.y + 8}`
                : `M ${activeMuscle.tipPoint.x - 15} ${activeMuscle.tipPoint.y - 8} L ${activeMuscle.tipPoint.x} ${activeMuscle.tipPoint.y} L ${activeMuscle.tipPoint.x - 15} ${activeMuscle.tipPoint.y + 8}`}
            />
          </g>}
        </svg>
        {activeMuscle && <aside
          key={activeMuscle.id}
          className={`fit-muscle-callout is-${activeMuscle.side}`}
          style={{ '--callout-top': activeMuscle.calloutTop } as CSSProperties}
          aria-live="polite"
          onPointerEnter={() => activateMuscle(activeMuscle.id)}
          onMouseEnter={() => activateMuscle(activeMuscle.id)}
        >
          <span className="fit-muscle-zone-badge">{activeMuscle.zone}</span>
          <h3>{activeMuscle.name}</h3>
          <p className="fit-muscle-goal"><strong>Mục tiêu:</strong> {activeMuscle.goal}</p>
          <ul className="fit-muscle-exercises">
            {activeMuscle.exercises.map((exercise) => <li key={exercise}><span aria-hidden="true">✦</span>{exercise}</li>)}
          </ul>
          <Link to={muscleDetailPath} className="fit-pill fit-muscle-cta">
            Xem chi tiết &amp; Mua gói tập<RoundArrow diagonal />
          </Link>
        </aside>}
      </div>
      <div className="fit-hero-action"><Link to={joinPath} className="fit-pill">Bắt đầu ngay<RoundArrow /></Link><span>YOUR BODY. YOUR JOURNEY.</span></div>
      <span className="fit-hero-index" aria-hidden="true">01 / THE BEGINNING</span>
    </section>
    <section className="fit-services" id="disciplines" aria-label="Các hình thức tập luyện">
      <div className="fit-services-glow" aria-hidden="true" />
      {services.map((service, index) => <a key={service.title} className={`fit-service fit-service-${index}`} data-reveal="lift" href="#packages"><svg className="fit-service-surface" viewBox="0 0 320 280" preserveAspectRatio="none" aria-hidden="true"><path d={serviceShapes[index]} /></svg><ServiceIcon type={service.icon} /><h2>{service.title}</h2><span className="fit-service-rule" /><p>{service.description}</p></a>)}
    </section>
    <div className="fit-ticker" aria-hidden="true">
      <div className="fit-marquee-track">
        {[0, 1].map((groupIndex) => <div key={groupIndex} className="fit-marquee-group">
          {tickerItems.map((item) => <span key={`${groupIndex}-${item}`} className="fit-marquee-item">{item}<i /></span>)}
        </div>)}
      </div>
    </div>
    <section className="fit-section fit-space" id="about" aria-labelledby="space-title"><span id="intelligence" />
      <div className="fit-metrics-grid" aria-label="Tiêu chuẩn câu lạc bộ">
        {clubMetrics.map((item) => <article key={item.label} className="fit-metric-card" data-reveal="lift">
          <span className="fit-kicker">{item.label}</span>
          {'countTo' in item && item.countTo !== undefined
            ? <CountUpMetric value={item.value} countTo={item.countTo} format={item.format} />
            : <strong>{item.value}</strong>}
        </article>)}
      </div>
      <p className="fit-manifesto" data-scroll-scrub="manifesto" data-reveal="soft">
        {manifestoWords.map((word, idx) => <span key={idx} className="fit-manifesto-word"><span>{word}</span> </span>)}
      </p>
      <div className="fit-space-image" data-reveal="image" onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}>
        <img key={spaces[space].image} src={spaces[space].image} alt={spaces[space].title} loading="lazy" />
        <div className="fit-space-shade" />
        <div key={space} className="fit-space-content fit-blur-morph">
          <span className="fit-kicker">05 PHÂN KHU TẬP LUYỆN</span>
          <h2 id="space-title">{spaces[space].title}</h2>
          <div className="fit-space-live" style={{ '--space-load': spaces[space].load } as CSSProperties}>
            <div className="fit-space-live-head">
              <span>{spaces[space].meta}</span>
              <strong>{spaces[space].load} công suất</strong>
            </div>
            <div className="fit-space-meter"><i /></div>
            <span className="fit-space-status"><b />{spaces[space].status}</span>
          </div>
          <a className="fit-pill" href="#contact">Ghé thăm SÖL<RoundArrow diagonal /></a>
        </div>
        <div className="fit-space-tabs" aria-label="Khám phá không gian">{spaces.map((item, index) => <button type="button" key={item.label} onClick={() => setSpace(index)} className={space === index ? 'is-active' : ''} aria-pressed={space === index}><img src={item.image} alt="" loading="lazy" /><span>{item.label}</span><span className="fit-space-tab-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" /></svg></span></button>)}</div>
        <span className="fit-space-number">0{space + 1} / 0{spaces.length}</span>
      </div>
      <div className="fit-rhythm-explorer" data-reveal="lift" aria-label="Nhịp sinh hoạt trong ngày tại câu lạc bộ">
        <div className="fit-rhythm-head">
          <div>
            <span className="fit-kicker">NHỊP TẬP TRONG NGÀY</span>
            <h3>Khung giờ hoạt động thực tế</h3>
          </div>
          <div className="fit-rhythm-tabs" role="tablist" aria-label="Chọn khung giờ trong ngày">
            {dailyRhythmItems.map((item, idx) => <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeRhythmIdx === idx}
              className={activeRhythmIdx === idx ? 'is-active' : ''}
              onClick={() => setActiveRhythmIdx(idx)}
            >
              {item.label}
            </button>)}
          </div>
        </div>
        <div key={activeRhythm.id} className="fit-rhythm-body fit-blur-morph">
          <div className="fit-rhythm-copy">
            <h4>{activeRhythm.title}</h4>
            <ul>
              {activeRhythm.highlights.map((pt) => <li key={pt}><span aria-hidden="true">✓</span>{pt}</li>)}
            </ul>
          </div>
          <div className="fit-space-live fit-rhythm-meter" style={{ '--space-load': activeRhythm.crowdLoad } as CSSProperties}>
            <div className="fit-space-live-head">
              <span>Mật độ trung bình</span>
              <strong>{activeRhythm.crowdLoad}</strong>
            </div>
            <div className="fit-space-meter"><i /></div>
            <span className="fit-space-status"><b />{activeRhythm.crowdText}</span>
          </div>
        </div>
      </div>
    </section>
    <section className="fit-section fit-multisport" id="multisport" aria-labelledby="multisport-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft">
        <span className="fit-kicker">AQUATICS &amp; TENNIS CLUB</span>
        <SplitHeading id="multisport-title" lines={['Hồ Bơi Bốn Mùa &', 'Sân Tennis Tiêu Chuẩn']} />
      </div>
      <div className="fit-sport-bento-grid">
        {multiSportShowcase.map((sport) => <article
          key={sport.id}
          className="fit-sport-card"
          data-reveal="lift"
          onPointerMove={handleCardPointerMove}
          onPointerLeave={handleCardPointerLeave}
        >
          <img src={sport.image} alt={sport.title} loading="lazy" />
          <div className="fit-sport-card-shade" />
          <div className="fit-sport-card-body">
            <span className="fit-kicker">{sport.kicker}</span>
            <h3>{sport.title}</h3>
            <div className="fit-sport-tag-row">
              {sport.tags.map((tag) => <span key={tag} className="fit-sport-tag">{tag}</span>)}
            </div>
            <span className="fit-card-meta-reveal">{sport.hoverMeta}</span>
            <Link to={sport.path} className="fit-sport-trigger">
              {sport.cta} <RoundArrow diagonal />
            </Link>
          </div>
        </article>)}
      </div>
    </section>
    <section className="fit-section fit-trainers" id="trainers" aria-labelledby="trainers-title">
      <div className="fit-section-heading" data-reveal="soft">
        <span className="fit-kicker">BETTER WITH A COACH</span>
        <SplitHeading id="trainers-title" lines={['Our Trainers']} />
        <div className="fit-trainer-quick-links" aria-label="Xem nhanh trang giới thiệu huấn luyện viên">
          {trainers.map((item) => <Link key={item.slug} to={`/trainers/${item.slug}`} className="fit-trainer-chip">
            <strong>{item.personName}</strong>
            <span>{item.name} ↗</span>
          </Link>)}
        </div>
        <a href="#contact" className="fit-text-link">Trao đổi về mục tiêu của bạn <RoundArrow diagonal /></a>
        <div className="fit-slider-controls" aria-label="Chọn nhóm huấn luyện">
          {[0, 1, 2].map((index) => <button key={index} type="button" className={trainerPage === index ? 'is-active' : ''} onClick={() => setTrainerPage(index)} aria-label={`Nhóm huấn luyện ${index + 1}`} aria-pressed={trainerPage === index} />)}
        </div>
      </div>
      <div className="fit-trainer-grid" key={trainerPage}>
        {visibleTrainers.map((trainer) => <article className="fit-trainer-card" data-reveal="lift" key={trainer.slug} onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}>
          <Link to={`/trainers/${trainer.slug}`} className="fit-trainer-card-link" aria-label={`Xem câu chuyện của ${trainer.personName} (${trainer.name})`}>
            <img src={`/images/fitness/${trainer.image}`} alt={trainer.personName} loading="lazy" />
            <div className="fit-trainer-card-info">
              <span className="fit-trainer-vn-name">{trainer.personName}</span>
              <h3>{trainer.name}</h3>
              <p>{trainer.specialty}</p>
              <span className="fit-card-meta-reveal">{trainer.meta}</span>
              <span className="fit-trainer-story-cta">Xem trang giới thiệu →</span>
            </div>
            <RoundArrow diagonal />
          </Link>
        </article>)}
      </div>
    </section>
    <section className="fit-section fit-schedule" id="schedule" aria-labelledby="schedule-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft">
        <SplitHeading id="schedule-title" lines={['Weekly Class', 'Schedule']} />
      </div>
      <div className="fit-pricing-switch fit-schedule-switch" data-reveal="soft" aria-label="Lọc bộ môn trong lịch lớp">
        <button type="button" onClick={() => setScheduleFilter('all')} aria-pressed={scheduleFilter === 'all'}>Tất cả khung giờ</button>
        <button type="button" onClick={() => setScheduleFilter('strength')} aria-pressed={scheduleFilter === 'strength'}>Strength &amp; Barbell</button>
        <button type="button" onClick={() => setScheduleFilter('movement')} aria-pressed={scheduleFilter === 'movement'}>Movement &amp; Core</button>
        <button type="button" onClick={() => setScheduleFilter('conditioning')} aria-pressed={scheduleFilter === 'conditioning'}>Aquatics &amp; Tennis</button>
      </div>
      <div key={scheduleFilter} className="fit-schedule-grid">
        {visibleSchedule.map((item) => <article key={`${item.time}-${item.title}`} className="fit-schedule-card" data-reveal="lift">
          <div className="fit-schedule-top">
            <span className="fit-schedule-time">{item.time}</span>
            <span className="fit-schedule-spots">{item.studio}</span>
          </div>
          <h3>{item.title}</h3>
          <div className="fit-schedule-meta">
            <span>HLV: {item.coach}</span>
            <span>•</span>
            <span>{item.level}</span>
          </div>
          <Link to={joinPath} className="fit-text-link">Đặt lớp <RoundArrow diagonal /></Link>
        </article>)}
      </div>
    </section>
    <section className="fit-section fit-journey" id="journey" aria-labelledby="journey-title">
      <div className="fit-journey-steps" data-reveal="soft">
        <div className="fit-section-heading">
          <span className="fit-kicker">HOW YOUR ROUTINE BEGINS</span>
          <SplitHeading id="journey-title" lines={['Your First Week', 'At SÖL']} />
        </div>
        <ol className="fit-step-list" style={{ '--active-step': activeStep } as CSSProperties}>
          {journeySteps.map((item, index) => <li
            key={item.step}
            className={`fit-step-item ${activeStep === index ? 'is-active' : ''}`}
            data-reveal="lift"
            onPointerEnter={() => setActiveStep(index)}
            onClick={() => setActiveStep(index)}
          >
            <span className="fit-step-badge">{item.step}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </li>)}
        </ol>
        <div key={activeStep} className="fit-journey-preview fit-blur-morph" aria-label="Minh họa trực quan theo từng bước">
          {activeStep === 0 ? <div className="fit-preview-widget fit-preview-qr">
            <div className="fit-preview-head">
              <span className="fit-kicker">01 · DIGITAL PASS &amp; SLOT CHECK</span>
              <span className="fit-preview-live"><i />QR Active</span>
            </div>
            <div className="fit-preview-slots" aria-hidden="true">
              {['06:30', '08:00', '09:30', '12:00', '16:00', '17:30', '18:30', '19:30'].map((slot, idx) => <span
                key={slot}
                className={`fit-slot-pill ${idx === 5 ? 'is-selected' : idx === 1 || idx === 6 ? 'is-busy' : ''}`}
                style={{ '--slot-idx': idx } as CSSProperties}
              >
                {slot}
              </span>)}
            </div>
          </div> : activeStep === 1 ? <div className="fit-preview-widget fit-preview-ai">
            <div className="fit-preview-head">
              <span className="fit-kicker">02 · WEEKLY MULTI-SPORT PLAN</span>
              <span className="fit-preview-live"><i />Gợi ý mẫu</span>
            </div>
            <div className="fit-preview-chat" aria-hidden="true">
              <div className="fit-chat-user">Mục tiêu săn chắc · 4 buổi/tuần sau 17:30</div>
              <div className="fit-chat-bot">
                <div className="fit-chat-tags">
                  <span>T2 · Strength</span>
                  <span>T4 · Bơi lội</span>
                  <span>T6 · Tennis</span>
                  <span>CN · Mobility</span>
                </div>
              </div>
            </div>
          </div> : <div className="fit-preview-widget fit-preview-chart">
            <div className="fit-preview-head">
              <span className="fit-kicker">03 · CONSISTENCY CURVE</span>
              <span className="fit-preview-live"><i />85% hoàn thành</span>
            </div>
            <svg className="fit-progress-svg" viewBox="0 0 320 92" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="fit-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ce9180" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#ce9180" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="fit-curve-area" d="M12 74 C 70 68, 110 52, 162 44 C 214 36, 256 22, 308 14 L 308 84 L 12 84 Z" fill="url(#fit-curve-fill)" />
              <path className="fit-curve-line" d="M12 74 C 70 68, 110 52, 162 44 C 214 36, 256 22, 308 14" />
              {[
                { cx: 12, cy: 74, label: 'W1' },
                { cx: 110, cy: 55, label: 'W2' },
                { cx: 208, cy: 34, label: 'W3' },
                { cx: 308, cy: 14, label: 'W4' },
              ].map((pt, idx) => <g key={pt.label} className="fit-curve-dot" style={{ '--dot-idx': idx } as CSSProperties}>
                <circle cx={pt.cx} cy={pt.cy} r="4.5" />
              </g>)}
            </svg>
          </div>}
        </div>
      </div>
      <div className="fit-bmi-card" data-reveal="tilt" aria-labelledby="bmi-title">
        <span className="fit-kicker">BODY METRIC &amp; GOAL CHECK</span>
        <h3 id="bmi-title">Tính Nhanh BMI &amp; Lộ Trình<span className="fit-title-dot">.</span></h3>
        <div className="fit-bmi-inputs">
          <label htmlFor="fit-bmi-height">
            <span>Chiều cao (cm)</span>
            <input id="fit-bmi-height" type="number" min={100} max={240} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </label>
          <label htmlFor="fit-bmi-weight">
            <span>Cân nặng (kg)</span>
            <input id="fit-bmi-weight" type="number" min={30} max={250} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </label>
        </div>
        <div className="fit-bmi-goals" role="group" aria-label="Chọn mục tiêu tập luyện">
          <button type="button" onClick={() => setGoalType('lean')} aria-pressed={goalType === 'lean'}>Giảm mỡ &amp; Săn chắc</button>
          <button type="button" onClick={() => setGoalType('muscle')} aria-pressed={goalType === 'muscle'}>Tăng cơ &amp; Sức mạnh</button>
          <button type="button" onClick={() => setGoalType('balance')} aria-pressed={goalType === 'balance'}>Dẻo dai &amp; Cân bằng</button>
        </div>
        <div className="fit-bmi-result" aria-live="polite">
          <div>
            <span className="fit-kicker">CHỈ SỐ BMI ƯỚC TÍNH</span>
            <strong>{bmiValue !== null ? bmiValue : '—'}</strong>
            <span>{bmiStatus}</span>
          </div>
          <p><strong>Gợi ý:</strong> {recommendedPlan}</p>
        </div>
        <Link to={joinPath} className="fit-pill">Nhận lộ trình<RoundArrow diagonal /></Link>
      </div>
    </section>
    <section className="fit-section fit-pricing" id="packages" aria-labelledby="pricing-title"><div className="fit-section-heading fit-centered" data-reveal="soft"><span className="fit-kicker">MAKE TIME FOR YOURSELF</span><SplitHeading id="pricing-title" lines={['Membership Pricing']} /></div><div className="fit-pricing-switch" data-reveal="soft" aria-label="Lọc thời hạn gói tập"><button type="button" onClick={() => setPlanMode('all')} aria-pressed={planMode === 'all'}>Tất cả gói tập</button><button type="button" onClick={() => setPlanMode('long')} aria-pressed={planMode === 'long'}>Đồng hành dài hạn</button></div>
      <div key={planMode} className={`fit-pricing-grid ${planMode === 'long' ? 'fit-pricing-grid-two' : ''}`}>{plans.filter((_, index) => planMode === 'all' || index > 0).map((plan) => <article key={plan.name} data-reveal="lift" className={`fit-plan ${plan.period === 'Quý' ? 'fit-plan-featured' : ''}`}><span className="fit-plan-period">{plan.period}</span><h3>{plan.name}</h3><div className="fit-plan-price">{plan.price}<span>VNĐ / {plan.duration}</span></div><ul>{plan.perks.map((perk) => <li key={perk}><span aria-hidden="true">✓</span>{perk}</li>)}</ul><Link className="fit-pill" to={joinPath}>Tham gia ngay<RoundArrow diagonal /></Link></article>)}</div>
    </section>
    <section className="fit-section fit-stories" id="stories" aria-labelledby="stories-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft"><SplitHeading id="stories-title" lines={['Mỗi người,', 'một nhịp tập']} /></div>
      <div className="fit-story-grid">{stories.map((story) => <article className="fit-story" data-reveal="lift" key={story.name} onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}><Link to={`/trainers/${story.slug}`} className="fit-story-link"><div className="fit-story-photo"><img src={`/images/fitness/${story.image}`} alt={story.name} loading="lazy" /><div><span className="fit-story-focus">{story.focus}</span><h3>{story.name}</h3><span className="fit-card-meta-reveal">{story.meta}</span></div></div><p>“{story.quote}”</p></Link></article>)}</div>
    </section>
    <section className="fit-section fit-faq" id="faq" aria-labelledby="faq-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft">
        <span className="fit-kicker">FAQ</span>
        <SplitHeading id="faq-title" lines={['Frequently Asked', 'Questions']} />
      </div>
      <div className="fit-faq-list">
        {faqs.map((item, index) => {
          const expanded = openFaq === index;
          return <article key={item.question} className={`fit-faq-item ${expanded ? 'is-open' : ''}`} data-reveal="lift">
            <h3>
              <button
                type="button"
                className="fit-faq-trigger"
                aria-expanded={expanded}
                onClick={() => setOpenFaq(expanded ? -1 : index)}
              >
                <span>{item.question}</span>
                <span className="fit-faq-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={expanded ? 'M4 8h8' : 'M8 4v8M4 8h8'} />
                  </svg>
                </span>
              </button>
            </h3>
            {expanded && <p className="fit-faq-answer">{item.answer}</p>}
          </article>;
        })}
      </div>
    </section>
    <section className="fit-final-cta" data-reveal="soft"><span className="fit-kicker">ONE SMALL STEP. A STRONGER YOU.</span><h2>READY WHEN<br /><em>YOU ARE.</em></h2><Link to={joinPath} className="fit-pill">Bắt đầu hành trình<RoundArrow diagonal /></Link><span className="fit-cta-star" aria-hidden="true">✳</span></section>
  </main>;
}
