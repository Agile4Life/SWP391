import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../../shared/api/client';
import { RoundArrow } from './PublicLayout';

const tickerItems = [
  'STRENGTH FLOOR',
  'HEATED LAP POOL 25M',
  'CHAMPIONSHIP TENNIS',
  'MOVEMENT STUDIO',
  'HYDRO-RECOVERY',
  'ATHLETIC CONDITIONING',
  'BARBELL CLUB',
  'MULTI-SPORT PASS',
];

const manifestoWords = 'Không chỉ là một phòng tập cố định. SÖL là tổ hợp thể chất đa bộ môn — nơi sức mạnh tạ rời, làn nước ấm 25m, mặt sân Tennis chuẩn giải đấu và nhịp thở Pilates giao thoa để bạn bứt phá mỗi ngày.'.split(' ');

const services = [
  { title: 'WeightLifting', description: 'Xây nền sức mạnh, phát triển khối cơ và lực phát bùng nổ bổ trợ trực tiếp cho Bơi lội, Tennis và vận động hàng ngày.', icon: 'weights' },
  { title: 'Private Training', description: 'Huấn luyện 1:1 đa bộ môn — từ chỉnh kỹ thuật Squat, sải tay bơi chuẩn thủy động lực học đến bộ chân Split-Step trên sân Tennis.', icon: 'training' },
  { title: 'Build Muscle', description: 'Phối hợp tập tạ chuyên sâu, bơi kháng lực nước và vận động linh hoạt giúp cơ thể săn chắc, dẻo dai mà không quá tải khớp.', icon: 'muscle' },
];
const serviceShapes = [
  'M37 30L259 0Q290-2 295 32L319 231Q323 280 279 280H72Q33 280 27 241L1 80Q-5 40 37 30Z',
  'M42 0H278Q322 0 316 44L294 242Q290 280 251 280H69Q30 280 26 242L4 44Q-2 0 42 0Z',
  'M61 0L283 30Q325 40 319 80L293 241Q287 280 248 280H41Q-3 280 1 231L25 32Q30-2 61 0Z',
];
const clubMetrics = [
  { value: '06:00 — 22:00', countTo: 22, format: (n: number) => `06:00 — ${String(n).padStart(2, '0')}:00`, label: 'MỞ CỬA MỖI NGÀY', detail: 'Linh hoạt lịch tập Gym, bơi sáng sớm, đánh Tennis chiều muộn hoặc phục hồi sau giờ làm.' },
  { value: '05 Zones', countTo: 5, format: (n: number) => `${String(n).padStart(2, '0')} Zones`, label: 'TỔ HỢP ĐA BỘ MÔN', detail: 'Strength Floor, Free Weights, Movement Studio, Hồ bơi 4 mùa 25m & Sân Tennis chuẩn ITF.' },
  { value: 'Lịch lớp', label: 'ĐẶT CHỖ TRỰC TUYẾN', detail: 'Đặt lịch lớp nhóm, giữ làn bơi phân luồng hoặc đặt khung giờ sân Tennis trực tiếp trong tài khoản.' },
  { value: 'QR Pass', label: 'THẺ ĐA MÔN ĐIỆN TỬ', detail: 'Một thẻ QR duy nhất để check-in toàn bộ phân khu Gym, Hồ bơi và Sân Tennis khi gói tập còn hiệu lực.' },
];
const muscleGroups = [
  {
    id: 'chest',
    name: 'Cơ Ngực (Pectorals)',
    zone: 'UPPER & MID CHEST',
    goal: 'Tăng độ dày & đường nét khung ngực',
    tip: 'Kiểm soát nhịp hạ tạ 2–3 giây và ép xương bả vai về sau để cô lập cơ ngực, tránh dồn áp lực lên khớp vai trước.',
    exercises: [
      'Incline Dumbbell Press · 4 hiệp × 8–10 lần',
      'Cable Chest Fly (giữ đỉnh 1s) · 3 hiệp × 12 lần',
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
    goal: 'Mở rộng khung vai chữ V & ổn định khớp bả vai',
    tip: 'Đẩy và nâng tạ ngang trong mặt phẳng xương bả vai (góc 30° phía trước) để tối ưu cơ vai giữa và bảo vệ khớp.',
    exercises: [
      'Seated Dumbbell Overhead Press · 4 hiệp × 8–10 lần',
      'Controlled Lateral Raise & Face Pull · 4 hiệp × 12–15 lần',
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
    goal: 'Phát triển chu vi cánh tay & lực kéo–đẩy đối xứng',
    tip: 'Cố định khuỷu tay sát thân người khi cuộn tạ hoặc duỗi cáp; xoay ngửa cổ tay ở cuối biên độ để kích hoạt đỉnh bắp tay.',
    exercises: [
      'Seated Concentration / Incline Curl · 3 hiệp × 10–12 lần',
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
    goal: 'Siết cơ trọng tâm & bảo vệ cột sống thắt lưng',
    tip: 'Kết hợp thở ra nén chặt thành bụng (bracing) và cuộn xương sườn về phía khung chậu thay vì dùng quán tính gập hông.',
    exercises: [
      'Hanging Knee / Leg Raise có kiểm soát · 3 hiệp × 12 lần',
      'Cable Pallof Press & Plank giữ nhịp thở · 3 hiệp × 45 giây',
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
    goal: 'Tăng sức mạnh cầm nắm & kiểm soát mức tạ nặng',
    tip: 'Giữ cổ tay thẳng hàng với trục cẳng tay khi cầm tạ đơn; rèn lực nắm tĩnh giúp bảo vệ khớp cổ tay ở mọi bài kéo nặng.',
    exercises: [
      'Farmer’s Walk (Xách tạ đơn đi bộ) · 3 hiệp × 40m',
      'Reverse Dumbbell Curl & Dead Hang · 3 hiệp × 40 giây',
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
    goal: 'Xây nền tảng sức mạnh thân dưới & độ bùng nổ',
    tip: 'Phân bổ lực đều lên kiềng 3 điểm bàn chân, mở hướng đầu gối theo mũi chân và kiểm soát biên độ gập khớp gối – hông.',
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
const stories = [
  { name: 'Derek', image: 'coach-strength.png', quote: 'Kỷ luật bắt đầu từ việc có mặt. Mỗi ngày, thêm một chút tiến bộ.', focus: 'STRENGTH', meta: '12 tuần kỷ luật · Strength Floor' },
  { name: 'Anthony', image: 'trainer-strength.jpg', quote: 'Tôi tìm được nhịp tập phù hợp và học cách kiên trì với chính mình.', focus: 'CONSISTENCY', meta: '4 buổi/tuần · Personal Training' },
  { name: 'Jhon', image: 'strength-session.jpg', quote: 'Không chỉ là thay đổi vóc dáng. Tôi thấy khỏe và tự tin hơn.', focus: 'BALANCE', meta: '16 tuần · Movement & Core' },
  { name: 'Ezekiel', image: 'hero-athlete.png', quote: 'Có người đồng hành giúp tôi đi đúng hướng trong từng buổi tập.', focus: 'PROGRESS', meta: 'Câu chuyện minh họa · Barbell Club' },
];
const trainers = [
  { name: 'Strength coach', specialty: 'SỨC MẠNH & THỂ LỰC', image: 'coach-strength.png', meta: '12+ lớp/tuần · Cử tạ & Hypertrophy' },
  { name: 'Movement coach', specialty: 'CHUYỂN ĐỘNG & CÂN BẰNG', image: 'coach-movement.png', meta: '10+ lớp/tuần · Mobility & Reformer' },
  { name: 'Personal coach', specialty: 'HUẤN LUYỆN CÁ NHÂN', image: 'strength-session.jpg', meta: 'Huấn luyện 1:1 · Giáo án cá nhân hóa' },
];
const spaces = [
  { title: 'Không gian cho những mục tiêu lớn.', image: '/images/fitness/gym-floor.jpg', label: 'Strength floor', meta: '18 thiết bị chuẩn Olympic · Trần thoáng 6.5m', load: '68%', status: 'Đang thoáng · Sẵn sàng tập ngay' },
  { title: 'Tập trung vào từng chuyển động.', image: '/images/fitness/strength-session.jpg', label: 'Free weights', meta: 'Tạ đơn 2–50kg · 6 khung Power Rack chuyên sâu', load: '54%', status: 'Mật độ lý tưởng · Đủ tạ & rack' },
  { title: 'Tìm lại nhịp điệu của chính mình.', image: '/images/pilates-reformer-studio.jpg', label: 'Movement studio', meta: '12 máy Reformer · Không gian yên tĩnh tách biệt', load: '42%', status: 'Yên tĩnh · Ánh sáng dịu cân bằng' },
  { title: 'Làn nước tĩnh lặng chuẩn 25 mét.', image: '/images/fitness/aquatics-pool.jpg', label: 'Aquatics pool', meta: '6 làn bơi 25m · Điện phân muối khoáng 28°C', load: '48%', status: 'Nước ấm 28°C · Làn bơi thông thoáng' },
  { title: 'Mặt sân chuẩn giải đấu giàu năng lượng.', image: '/images/fitness/tennis-court.jpg', label: 'Tennis courts', meta: 'Mặt sân Cushion Acrylic 7 lớp · Đèn LED 750 Lux', load: '62%', status: 'Độ nảy chuẩn ITF · Sẵn sàng giao bóng' },
];
const scheduleItems = [
  { time: '06:30 — 07:20', title: 'Morning Strength Foundation', category: 'strength', studio: 'Strength floor', coach: 'Strength coach', level: 'Mọi cấp độ' },
  { time: '07:30 — 08:25', title: 'Aquatics Stroke & Endurance Clinic', category: 'conditioning', studio: 'Aquatics pool 25m', coach: 'Aquatics coach', level: 'Cơ bản — Nâng cao' },
  { time: '09:00 — 09:50', title: 'Reformer Core & Shoulder Mobility', category: 'movement', studio: 'Movement studio', coach: 'Movement coach', level: 'Mọi cấp độ' },
  { time: '17:30 — 18:25', title: 'Hypertrophy & Barbell Club', category: 'strength', studio: 'Free weights', coach: 'Strength coach', level: 'Trung bình — Nâng cao' },
  { time: '18:30 — 19:20', title: 'Dynamic Mobility & Hydro-Recovery', category: 'movement', studio: 'Movement & Pool', coach: 'Movement coach', level: 'Mọi cấp độ' },
  { time: '19:30 — 20:30', title: 'Tennis Footwork, Spin & Match Play', category: 'conditioning', studio: 'Championship Court', coach: 'Tennis coach', level: 'Trung bình — Thi đấu' },
];
const journeySteps = [
  { step: '01', title: 'Tạo tài khoản và chọn gói tập đa môn', description: 'Đăng ký, xác thực email và chọn gói tập linh hoạt mở quyền truy cập Gym, Hồ bơi 25m và Sân Tennis.' },
  { step: '02', title: 'Thiết lập lộ trình phối hợp bộ môn', description: 'Cập nhật chỉ số cơ thể và mục tiêu để kết hợp giữa tập tạ tăng lực, bơi sải sức bền và Tennis phản xạ.' },
  { step: '03', title: 'Đặt lớp, giữ làn bơi & mở thẻ QR', description: 'Khi gói tập có hiệu lực, chọn lớp nhóm, làn bơi hoặc khung giờ sân Tennis và dùng 1 thẻ QR duy nhất để check-in.' },
];
const plans = [
  { period: 'Tháng', name: 'The Essential', price: '2.800.000', duration: '30 ngày', description: 'Khởi động thói quen vận động đa môn linh hoạt mỗi tuần.', perks: ['Khu vực Gym, Free Weights & Hồ bơi 25m', 'Các lớp học nhóm & bơi thả lỏng phục hồi', 'Thẻ hội viên QR điện tử đa phân khu'] },
  { period: 'Quý', name: 'The Sanctuary', price: '7.500.000', duration: '90 ngày', description: 'Phối hợp toàn diện giữa sức mạnh, bơi lội và phản xạ trên sân Tennis.', perks: ['Toàn quyền 05 phân khu: Gym, Studio, Hồ bơi & Tennis', 'Lớp kỹ thuật Bơi lội, Tennis Clinic & Reformer', 'Ưu tiên đặt khung giờ sân và làn bơi tại Portal'] },
  { period: 'Năm', name: 'The Sovereign', price: '26.000.000', duration: '365 ngày', description: 'Đặc quyền thể thao đa bộ môn trọn vẹn suốt 4 mùa.', perks: ['Không giới hạn 05 phân khu & khung giờ sân Tennis', 'Đánh giá cơ sinh học & thiết kế giáo án đa môn', 'Đặc quyền bảo lưu (Freeze) và khách mời đi cùng'] },
];
const faqs = [
  {
    question: 'Người mới bắt đầu chưa từng tập gym, bơi kỹ thuật hay đánh Tennis có theo kịp lộ trình tại SÖL không?',
    answer: 'Hoàn toàn phù hợp. SÖL thiết kế các lớp nhập môn riêng biệt cho từng bộ môn: làm quen chuyển động tạ cơ bản, chuẩn hóa nhịp thở và tư thế nổi ngang trong bơi lội, cũng như kỹ thuật cầm vợt và bộ chân nền tảng trong Tennis.',
  },
  {
    question: 'Gói hội viên đã bao gồm quyền sử dụng Hồ bơi 4 mùa 25m và Sân Tennis chưa?',
    answer: 'Tất cả gói hội viên tại SÖL đều mở quyền tiếp cận tổ hợp đa môn theo hạng gói: từ khu Gym & Hồ bơi nước ấm 28°C ở gói The Essential cho đến đặc quyền toàn bộ 05 phân khu (bao gồm Sân Tennis Cushion Acrylic và lớp chuyên đề) ở gói The Sanctuary và The Sovereign.',
  },
  {
    question: 'Tôi có thể tạm dừng (bảo lưu) gói tập khi đi công tác hoặc bận lịch cá nhân không?',
    answer: 'Có. Hội viên có thể gửi yêu cầu bảo lưu (Freeze) trực tiếp trên không gian hội viên trực tuyến. Số ngày còn lại của gói tập sẽ được giữ nguyên và mở lại dễ dàng khi bạn quay lại tập luyện.',
  },
  {
    question: 'Làm thế nào để đặt chỗ lớp học, giữ làn bơi hoặc đặt sân Tennis?',
    answer: 'Sau khi đăng nhập vào Portal hội viên, bạn có thể xem lịch thực tế của cả 05 phân khu, kiểm tra mật độ làn bơi, khung giờ trống của sân Tennis và đặt chỗ trước chỉ với một chạm hoặc tham gia danh sách chờ (Waitlist) tự động.',
  },
  {
    question: 'Tại sao mô hình tập luyện đa môn (Gym + Bơi lội + Tennis) lại hiệu quả hơn tập cố định 1 môn?',
    answer: 'Phối hợp đa bộ môn (Cross-Training) giúp cơ thể phát triển toàn diện: tập tạ xây dựng sức mạnh cơ lõi và bảo vệ dây chằng; Tennis rèn phản xạ thần kinh – cơ và tốc độ đổi hướng; còn Bơi lội giúp tăng dung tích phổi (VO₂ Max) và giải phóng áp lực lên cột sống, khớp gối.',
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
    {type === 'weights' ? <>
      <path d="M6 17h52" /><rect x="3" y="10" width="5" height="15" rx="1" fill="#ada59a" /><rect x="10" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="49" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="56" y="10" width="5" height="15" rx="1" fill="#ada59a" />
      <path d="m26 28-6-5V13h5v7l5 4h4l5-4v-7h5v10l-6 5 1 13H25Z" fill="#ebc18c" /><circle cx="32" cy="18" r="6" fill="#ebc18c" /><path d="M27 14c0-5 10-5 10 0" fill="#705648" /><path d="m25 40-2 10 5 1 4-8 4 8 5-1-2-10Z" fill="#e69e87" /><path d="m23 50-1 10h6l1-9m6 0 1 9h6l-1-10" fill="#ebc18c" /><path d="M21 60h8m6 0h8M29 32h6" />
    </> : type === 'training' ? <>
      <g transform="rotate(-37 34 23)"><path d="M15 22h36v5H15Z" fill="#e6a08a" /><rect x="10" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="4" y="18" width="6" height="13" rx="1" fill="#e6907e" /><rect x="49" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="56" y="18" width="5" height="13" rx="1" fill="#e6907e" /></g>
      <path d="M14 44h34v5H14Z" fill="#e8d6b9" /><rect x="9" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="3" y="39" width="6" height="15" rx="1" fill="#ded2c1" /><rect x="47" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="54" y="39" width="6" height="15" rx="1" fill="#ded2c1" />
    </> : <>
      <path d="M12 44c-1-10 2-21 7-29l10 4-5 13c8-8 17-6 21-1l7 8 2 10c-12 8-29 7-42-5Z" fill="#e9c59b" /><path d="m19 15 2-9 9 1 4 8-5 4m-8-4 4-4 4 3M32 34c0 6 4 10 9 10m-22 0c3 3 8 4 12 3M47 44l8-3" />
      <circle cx="48" cy="13" r="10" fill="#edc7a5" /><path d="M48 18s-7-4-5-8c1-2 4-2 5 0 2-2 5-2 6 0 2 4-6 8-6 8Z" fill="#df9785" />
    </>}
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
    ? 'The Sanctuary (90 ngày) · 2 buổi Strength + 2 buổi Bơi sải đốt mỡ + 1 buổi Tennis phản xạ/tuần'
    : goalType === 'muscle'
      ? 'The Sanctuary (90 ngày) · 3 buổi Hypertrophy + 1 buổi Tennis bùng nổ + 1 buổi Thủy trị liệu/tuần'
      : 'The Essential (30 ngày) · 2 buổi Reformer Mobility + 2 buổi Bơi 4 mùa giải phóng khớp/tuần';

  const visibleSchedule = scheduleItems.filter((item) => scheduleFilter === 'all' || item.category === scheduleFilter);

  return <main id="public-main">
    <section className="fit-hero" id="hero" aria-labelledby="hero-title">
      <div className="fit-hero-lines" aria-hidden="true" />
      <h1 id="hero-title" className="fit-hero-title"><span>BUILD YOUR</span><span>BODY SHAPES<span className="fit-title-dot">.</span></span></h1>
      <div className="fit-hero-copy"><p>Mạnh mẽ từ thể chất.<br />Tự tin từ bên trong.</p><p>Mỗi người một điểm bắt đầu. Tìm cách tập luyện của bạn, cùng SÖL xây dựng một cơ thể khỏe và một tinh thần cân bằng.</p>
        <a href="#stories" className="fit-reviews"><span>Cùng nhau tiến bộ</span><span className="fit-avatar-row">{stories.slice(0, 3).map((story) => <img key={story.name} src={`/images/fitness/${story.image}`} alt="" />)}<span className="fit-review-arrow">↗</span></span><span className="fit-review-label">Mỗi hành trình đều đáng giá</span></a>
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
          <p className="fit-muscle-tip">{activeMuscle.tip}</p>
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
    <section className="fit-section fit-metrics" aria-label="Tiêu chuẩn câu lạc bộ">
      <div className="fit-metrics-grid">
        {clubMetrics.map((item) => <article key={item.label} className="fit-metric-card" data-reveal="lift">
          <span className="fit-kicker">{item.label}</span>
          {'countTo' in item && item.countTo !== undefined
            ? <CountUpMetric value={item.value} countTo={item.countTo} format={item.format} />
            : <strong>{item.value}</strong>}
          <p>{item.detail}</p>
        </article>)}
      </div>
    </section>
    <section className="fit-section fit-stories" id="stories" aria-labelledby="stories-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft"><SplitHeading id="stories-title" lines={['Mỗi người,', 'một nhịp tập']} /><p>Những câu chuyện minh họa về mục tiêu và thói quen tập luyện.</p></div>
      <div className="fit-story-grid">{stories.map((story) => <article className="fit-story" data-reveal="lift" key={story.name} onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}><div className="fit-story-photo"><img src={`/images/fitness/${story.image}`} alt={`Ảnh minh họa hành trình ${story.focus.toLowerCase()}`} loading="lazy" /><div><span className="fit-story-focus">{story.focus}</span><h3>{story.name}</h3><span className="fit-card-meta-reveal">{story.meta}</span></div></div><p>“{story.quote}”</p></article>)}</div>
      <p className="fit-disclosure">Câu chuyện và hình ảnh minh họa cho bản thiết kế.</p>
    </section>
    <section className="fit-section fit-trainers" id="trainers" aria-labelledby="trainers-title">
      <div className="fit-section-heading" data-reveal="soft"><span className="fit-kicker">BETTER WITH A COACH</span><SplitHeading id="trainers-title" lines={['Our Trainers']} /><p>Đúng kỹ thuật. Đúng nhịp độ. Đúng với bạn. Khám phá những cách tập luyện cùng người hướng dẫn, từ nền tảng đến mục tiêu tiếp theo.</p><a href="#contact" className="fit-text-link">Trao đổi về mục tiêu của bạn <RoundArrow diagonal /></a><div className="fit-slider-controls" aria-label="Chọn nhóm huấn luyện">{[0, 1].map((index) => <button key={index} type="button" className={trainerPage === index ? 'is-active' : ''} onClick={() => setTrainerPage(index)} aria-label={`Nhóm huấn luyện ${index + 1}`} aria-pressed={trainerPage === index} />)}</div></div>
      <div className="fit-trainer-grid" key={trainerPage}>{trainers.slice(trainerPage, trainerPage + 2).map((trainer) => <article className="fit-trainer-card" data-reveal="lift" key={trainer.name} onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}><img src={`/images/fitness/${trainer.image}`} alt={`Ảnh minh họa ${trainer.name}`} loading="lazy" /><div><h3>{trainer.name}</h3><p>{trainer.specialty}</p><span className="fit-card-meta-reveal">{trainer.meta}</span><span>Ảnh minh họa</span></div><RoundArrow diagonal /></article>)}</div>
    </section>
    <section className="fit-section fit-space" id="about" aria-labelledby="space-title"><span id="intelligence" />
      <p className="fit-manifesto" data-scroll-scrub="manifesto" data-reveal="soft">
        {manifestoWords.map((word, idx) => <span key={idx} className="fit-manifesto-word"><span>{word}</span> </span>)}
      </p>
      <div className="fit-space-image" data-reveal="image" onPointerMove={handleCardPointerMove} onPointerLeave={handleCardPointerLeave}>
        <img key={spaces[space].image} src={spaces[space].image} alt={spaces[space].title} loading="lazy" />
        <div className="fit-space-shade" />
        <div key={space} className="fit-space-content fit-blur-morph">
          <span className="fit-kicker">A PLACE TO SHOW UP</span>
          <h2 id="space-title">{spaces[space].title}</h2>
          <p>Không gian tập luyện, nguồn năng lượng mới và thời gian dành riêng cho bạn.</p>
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
        <div className="fit-space-tabs" aria-label="Khám phá không gian">{spaces.map((item, index) => <button type="button" key={item.label} onClick={() => setSpace(index)} className={space === index ? 'is-active' : ''} aria-pressed={space === index}><img src={item.image} alt="" loading="lazy" /><span>{item.label}</span><span aria-hidden="true">↗</span></button>)}</div>
        <span className="fit-space-number">0{space + 1} / 0{spaces.length}</span>
      </div>
    </section>
    <section className="fit-section fit-schedule" id="schedule" aria-labelledby="schedule-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft">
        <SplitHeading id="schedule-title" lines={['Weekly Class', 'Schedule']} />
        <p>Lịch minh họa các bộ môn và khung giờ.<br />Đăng nhập để xem lịch thực tế và số chỗ còn trống.</p>
      </div>
      <div className="fit-pricing-switch fit-schedule-switch" data-reveal="soft" aria-label="Lọc bộ môn trong lịch lớp">
        <button type="button" onClick={() => setScheduleFilter('all')} aria-pressed={scheduleFilter === 'all'}>Tất cả khung giờ</button>
        <button type="button" onClick={() => setScheduleFilter('strength')} aria-pressed={scheduleFilter === 'strength'}>Strength &amp; Barbell</button>
        <button type="button" onClick={() => setScheduleFilter('movement')} aria-pressed={scheduleFilter === 'movement'}>Movement &amp; Core</button>
        <button type="button" onClick={() => setScheduleFilter('conditioning')} aria-pressed={scheduleFilter === 'conditioning'}>Conditioning</button>
      </div>
      <div key={scheduleFilter} className="fit-schedule-grid">
        {visibleSchedule.map((item) => <article key={`${item.time}-${item.title}`} className="fit-schedule-card" data-reveal="lift">
          <div className="fit-schedule-top">
            <span className="fit-schedule-time">{item.time}</span>
            <span className="fit-schedule-spots">Lịch minh họa</span>
          </div>
          <h3>{item.title}</h3>
          <div className="fit-schedule-meta">
            <span>{item.studio}</span>
            <span>•</span>
            <span>{item.coach}</span>
            <span>•</span>
            <span>{item.level}</span>
          </div>
          <Link to={joinPath} className="fit-text-link">Xem lịch &amp; đặt lớp <RoundArrow diagonal /></Link>
        </article>)}
      </div>
      <p className="fit-disclosure">Lịch lớp tiêu biểu minh họa theo khung giờ trong ngày. Hội viên xem lịch thực tế và đặt chỗ trực tiếp trong Portal.</p>
    </section>
    <section className="fit-section fit-journey" id="journey" aria-labelledby="journey-title">
      <div className="fit-journey-steps" data-reveal="soft">
        <div className="fit-section-heading">
          <span className="fit-kicker">HOW YOUR ROUTINE BEGINS</span>
          <SplitHeading id="journey-title" lines={['Your First Week', 'At SÖL']} />
          <p>Mọi thứ được thiết kế rõ ràng để bạn không bỡ ngỡ trong buổi tập đầu tiên — từ lúc nhận thẻ QR đến khi hoàn thành tuần tập luyện đầu tiên.</p>
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
              <span className="fit-preview-live"><i />QR Active · Quét 1 chạm</span>
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
            <p className="fit-preview-caption">Khung giờ minh họa. Đăng nhập để xem lịch thực tế và mở thẻ QR hội viên.</p>
          </div> : activeStep === 1 ? <div className="fit-preview-widget fit-preview-ai">
            <div className="fit-preview-head">
              <span className="fit-kicker">02 · LỊCH TẬP MINH HỌA</span>
              <span className="fit-preview-live"><i />Ví dụ tham khảo</span>
            </div>
            <div className="fit-preview-chat" aria-hidden="true">
              <div className="fit-chat-user">Mục tiêu tăng cơ săn chắc · 4 buổi/tuần sau 17:30</div>
              <div className="fit-chat-bot">
                <strong>Ví dụ lịch tập:</strong> Upper / Lower kết hợp 1 buổi Mobility phục hồi:
                <div className="fit-chat-tags">
                  <span>T2 · Upper Strength</span>
                  <span>T4 · Lower &amp; Core</span>
                  <span>T6 · Hypertrophy</span>
                  <span>CN · Mobility Flow</span>
                </div>
              </div>
            </div>
          </div> : <div className="fit-preview-widget fit-preview-chart">
            <div className="fit-preview-head">
              <span className="fit-kicker">03 · STRENGTH &amp; CONSISTENCY CURVE</span>
              <span className="fit-preview-live"><i />Dữ liệu minh họa</span>
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
            <div className="fit-preview-bar-row">
              <span>Tỷ lệ hoàn thành lịch tập tuần này</span>
              <strong>85%</strong>
            </div>
            <div className="fit-space-meter"><i style={{ '--space-load': '85%' } as CSSProperties} /></div>
          </div>}
        </div>
      </div>
      <div className="fit-bmi-card" data-reveal="tilt" aria-labelledby="bmi-title">
        <span className="fit-kicker">BODY METRIC &amp; GOAL CHECK</span>
        <h3 id="bmi-title">Tính Nhanh BMI &amp; Lộ Trình Gợi Ý<span className="fit-title-dot">.</span></h3>
        <p>Nhập chỉ số cơ bản để tham khảo mức BMI hiện tại và gợi ý tần suất tập luyện phù hợp tại SÖL.</p>
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
          <p><strong>Gợi ý lộ trình:</strong> {recommendedPlan}</p>
        </div>
        <Link to={joinPath} className="fit-pill">Nhận lộ trình cá nhân hóa<RoundArrow diagonal /></Link>
      </div>
    </section>
    <section className="fit-section fit-pricing" id="packages" aria-labelledby="pricing-title"><div className="fit-section-heading fit-centered" data-reveal="soft"><span className="fit-kicker">MAKE TIME FOR YOURSELF</span><SplitHeading id="pricing-title" lines={['Membership Pricing']} /><p>Chọn khoảng thời gian phù hợp.<br />Bắt đầu một cam kết với chính mình.</p></div><div className="fit-pricing-switch" data-reveal="soft" aria-label="Lọc thời hạn gói tập"><button type="button" onClick={() => setPlanMode('all')} aria-pressed={planMode === 'all'}>Tất cả gói tập</button><button type="button" onClick={() => setPlanMode('long')} aria-pressed={planMode === 'long'}>Đồng hành dài hạn</button></div>
      <div key={planMode} className={`fit-pricing-grid ${planMode === 'long' ? 'fit-pricing-grid-two' : ''}`}>{plans.filter((_, index) => planMode === 'all' || index > 0).map((plan) => <article key={plan.name} data-reveal="lift" className={`fit-plan ${plan.period === 'Quý' ? 'fit-plan-featured' : ''}`}><span className="fit-plan-period">{plan.period}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="fit-plan-price">{plan.price}<span>VNĐ / {plan.duration}</span></div><ul>{plan.perks.map((perk) => <li key={perk}><span aria-hidden="true">✓</span>{perk}</li>)}</ul><Link className="fit-pill" to={joinPath}>Tham gia ngay<RoundArrow diagonal /></Link></article>)}</div><p className="fit-disclosure">Giá và quyền lợi tham khảo từ nội dung giới thiệu hiện có. Xem gói đang mở bán trong portal hoặc liên hệ lễ tân để xác nhận.</p>
    </section>
    <section className="fit-section fit-faq" id="faq" aria-labelledby="faq-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft">
        <span className="fit-kicker">EVERYTHING YOU NEED TO KNOW</span>
        <SplitHeading id="faq-title" lines={['Frequently Asked', 'Questions']} />
        <p>Giải đáp nhanh những câu hỏi phổ biến trước khi bạn bắt đầu buổi tập đầu tiên tại SÖL.</p>
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
                <span className="fit-faq-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
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
