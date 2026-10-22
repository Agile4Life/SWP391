export interface TrainerProfile {
  slug: string;
  personName: string;
  name: string;
  specialty: string;
  shortRole: string;
  image: string;
  actionImage: string;
  meta: string;
  experienceYears: number;
  studentsCount: number;
  weeklySessions: number;
  quote: string;
  bio: string[];
  specialties: string[];
  schedulePreview: { day: string; time: string; className: string; zone: string }[];
}

export const trainerProfiles: TrainerProfile[] = [
  {
    slug: 'strength-coach',
    personName: 'Derek',
    name: 'Strength coach',
    specialty: 'STRENGTH & BARBELL',
    shortRole: 'HLV Sức mạnh & Tạ rời',
    image: 'coach-strength.png',
    actionImage: '/images/fitness/gym-floor.jpg',
    meta: '6 năm kinh nghiệm · Cử tạ & Hypertrophy',
    experienceYears: 6,
    studentsCount: 420,
    weeklySessions: 14,
    quote: 'Kỷ luật bắt đầu từ việc có mặt. Mỗi ngày, thêm một chút tiến bộ.',
    bio: [
      'Phụ trách khu vực Strength Floor — chuẩn hóa kỹ thuật Squat, Press, Deadlift và phát triển sức mạnh nền tảng.',
    ],
    specialties: [
      'Kỹ thuật tạ rời cơ bản cho người mới',
      'Tăng cơ – Giảm mỡ (Hypertrophy)',
      'Sức mạnh thân dưới & Core',
    ],
    schedulePreview: [
      { day: 'T2 · T4 · T6', time: '06:30 — 07:20', className: 'Morning Strength Foundation', zone: 'Strength floor' },
      { day: 'T3 · T5', time: '17:30 — 18:25', className: 'Hypertrophy & Barbell Club', zone: 'Free weights' },
    ],
  },
  {
    slug: 'movement-coach',
    personName: 'Elena',
    name: 'Movement coach',
    specialty: 'MOBILITY & CORE',
    shortRole: 'HLV Chuyển động & Giãn cơ',
    image: 'coach-movement.png',
    actionImage: '/images/about-movement-studio.jpg',
    meta: '5 năm kinh nghiệm · Mobility & Pilates',
    experienceYears: 5,
    studentsCount: 360,
    weeklySessions: 12,
    quote: 'Cơ thể khỏe là khi vai nhẹ, lưng êm và từng chuyển động đều linh hoạt.',
    bio: [
      'Phụ trách khu vực Movement Studio — tập trung mở khớp vai – hông, làm khỏe cơ lõi và phục hồi tư thế.',
    ],
    specialties: [
      'Giãn cơ cổ vai gáy & thắt lưng',
      'Làm khỏe cơ lõi (Core) & Cân bằng tư thế',
      'Mở biên độ khớp vai & hông',
    ],
    schedulePreview: [
      { day: 'T2 · T4 · T6', time: '09:00 — 09:50', className: 'Reformer Core & Shoulder Mobility', zone: 'Movement studio' },
      { day: 'T3 · T5', time: '18:30 — 19:20', className: 'Dynamic Mobility & Recovery', zone: 'Movement studio' },
    ],
  },
  {
    slug: 'personal-coach',
    personName: 'Jhon',
    name: 'Personal coach',
    specialty: '1:1 MULTI-SPORT COACHING',
    shortRole: 'HLV Cá nhân Đa bộ môn',
    image: 'strength-session.jpg',
    actionImage: '/images/fitness/strength-session.jpg',
    meta: '7 năm kinh nghiệm · Kèm 1:1 linh hoạt',
    experienceYears: 7,
    studentsCount: 310,
    weeklySessions: 16,
    quote: 'Không chỉ là thay đổi vóc dáng. Tôi muốn bạn thấy khỏe và tự tin hơn mỗi tuần.',
    bio: [
      'Thiết kế lộ trình kèm 1:1 gọn 45 phút theo thể trạng và lịch sinh hoạt cá nhân.',
    ],
    specialties: [
      'Huấn luyện 1:1 cho người mới bắt đầu',
      'Thiết kế lịch tập đa môn 45 phút/buổi',
      'Giảm mỡ – Săn chắc bền vững',
    ],
    schedulePreview: [
      { day: 'T2 — T6', time: '12:00 — 13:00', className: 'Private Coaching buổi trưa', zone: 'Free weights' },
      { day: 'T2 — T6', time: '17:30 — 20:30', className: 'Private Coaching sau giờ làm', zone: 'Strength floor' },
    ],
  },
  {
    slug: 'aquatics-coach',
    personName: 'Anthony',
    name: 'Aquatics coach',
    specialty: 'SWIMMING & HYDRO-RECOVERY',
    shortRole: 'HLV Bơi lội & Thủy trị liệu',
    image: 'trainer-strength.jpg',
    actionImage: '/images/fitness/aquatics-pool.jpg',
    meta: '8 năm kinh nghiệm · Bơi 4 kiểu & Sức bền',
    experienceYears: 8,
    studentsCount: 510,
    weeklySessions: 15,
    quote: 'Tôi tìm được nhịp tập phù hợp dưới nước và giúp học viên lướt nhẹ mà không tốn sức.',
    bio: [
      'Hướng dẫn nhịp thở, kỹ thuật bơi sải – bơi ếch và bơi sức bền cho người lớn.',
    ],
    specialties: [
      'Xóa sợ nước & Dạy bơi người lớn',
      'Chỉnh kỹ thuật Bơi sải, Bơi ếch',
      'Bơi sức bền & Thả lỏng dưới nước',
    ],
    schedulePreview: [
      { day: 'T3 · T5 · T7', time: '07:30 — 08:25', className: 'Aquatics Stroke & Endurance Clinic', zone: 'Aquatics pool' },
      { day: 'T2 · T4 · T6', time: '17:00 — 18:00', className: 'Lớp Bơi cơ bản & Kỹ thuật thở', zone: 'Aquatics pool' },
    ],
  },
  {
    slug: 'tennis-coach',
    personName: 'Ezekiel',
    name: 'Tennis coach',
    specialty: 'TENNIS & FOOTWORK',
    shortRole: 'HLV Tennis & Phản xạ sân đấu',
    image: 'hero-athlete.png',
    actionImage: '/images/fitness/tennis-court.jpg',
    meta: '7 năm kinh nghiệm · Kỹ thuật & Đánh đôi',
    experienceYears: 7,
    studentsCount: 280,
    weeklySessions: 14,
    quote: 'Có người đồng hành chỉnh từng bước chân giúp bạn tự tin trong mọi đường bóng.',
    bio: [
      'Hướng dẫn kỹ thuật Forehand, Backhand, giao bóng và di chuyển Split-Step từ cơ bản đến đánh đôi.',
    ],
    specialties: [
      'Tennis nhập môn cho người mới cầm vợt',
      'Kỹ thuật Forehand / Backhand & Giao bóng',
      'Bộ chân Split-Step & Chiến thuật đánh đôi',
    ],
    schedulePreview: [
      { day: 'T2 · T4 · T6', time: '19:30 — 20:30', className: 'Tennis Footwork, Spin & Match Play', zone: 'Tennis courts' },
      { day: 'T7 · CN', time: '16:30 — 18:30', className: 'Tennis Clinic & Giao lưu Đánh đôi', zone: 'Tennis courts' },
    ],
  },
];

export function getTrainerBySlug(slug?: string): TrainerProfile {
  return trainerProfiles.find((item) => item.slug === slug) ?? trainerProfiles[0];
}
