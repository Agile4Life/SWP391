import { sourceText } from '../../shared/i18n/sourceText';
import type { DisciplineId } from '../../shared/lib/disciplines';

/** Bộ môn phụ có trang giới thiệu riêng; Gym là bộ môn chính nên nằm ngay trên trang chủ. */
export type SportPageId = Exclude<DisciplineId, 'gym'>;

export interface SportPageData {
  id: SportPageId;
  path: string;
  /** Nhãn ngắn trên bộ chuyển trang */
  label: string;
  club: string;
  kicker: string;
  title: string;
  subtitle: string;
  image: string;
  programs: { code: string; title: string; tag: string }[];
}

export const SPORT_PAGES: Record<SportPageId, SportPageData> = {
  swimming: {
    id: 'swimming',
    path: '/swimming',
    get label() { return sourceText({ vi: 'Hồ Bơi', en: 'Swimming' }); },
    club: 'Aquatics Club',
    kicker: 'AQUATICS CLUB',
    get title() { return sourceText({ vi: 'Hồ Bơi Bốn Mùa', en: 'All-Season Lap Pool' }); },
    get subtitle() { return sourceText({ vi: 'Bơi lội · Sức bền · Thả lỏng', en: 'Swimming · Endurance · Recovery' }); },
    image: '/images/fitness/aquatics-pool.jpg',
    programs: [
      { code: '01', get title() { return sourceText({ vi: 'Làm Quen & Nhịp Thở', en: 'Water Comfort & Breathing' }); }, get tag() { return sourceText({ vi: 'Dành cho người mới', en: 'For beginners' }); } },
      { code: '02', get title() { return sourceText({ vi: 'Bơi Sải & Sức Bền', en: 'Freestyle & Endurance' }); }, get tag() { return sourceText({ vi: 'Kỹ thuật lướt nước', en: 'Glide technique' }); } },
      { code: '03', get title() { return sourceText({ vi: 'Thả Lỏng Dưới Nước', en: 'Aquatic Recovery' }); }, get tag() { return sourceText({ vi: 'Phục hồi sau buổi tập', en: 'Post-session recovery' }); } },
    ],
  },
  boxing: {
    id: 'boxing',
    path: '/boxing',
    label: 'Boxing',
    club: 'Boxing Club',
    kicker: 'BOXING CLUB',
    get title() { return sourceText({ vi: 'Phòng Tập Boxing', en: 'Boxing Ring Arena' }); },
    get subtitle() { return sourceText({ vi: 'Kỹ thuật · Phản xạ · Thể lực', en: 'Technique · Reflexes · Conditioning' }); },
    image: '/images/hero-options/opt5-boxing.jpg',
    programs: [
      { code: '01', get title() { return sourceText({ vi: 'Kỹ Thuật Đấm Cơ Bản', en: 'Foundational Striking' }); }, get tag() { return sourceText({ vi: 'Dành cho người mới', en: 'For beginners' }); } },
      { code: '02', get title() { return sourceText({ vi: 'Bộ Chân & Phản Xạ', en: 'Footwork & Reflexes' }); }, get tag() { return sourceText({ vi: 'Di chuyển và né đòn', en: 'Movement and defense' }); } },
      { code: '03', get title() { return sourceText({ vi: 'Thể Lực Theo Hiệp', en: 'Round Conditioning' }); }, get tag() { return sourceText({ vi: 'Sức bền qua từng hiệp', en: 'Round-by-round stamina' }); } },
    ],
  },
  tennis: {
    id: 'tennis',
    path: '/tennis',
    get label() { return sourceText({ vi: 'Sân Tennis', en: 'Tennis' }); },
    club: 'Tennis Club',
    kicker: 'TENNIS CLUB',
    get title() { return sourceText({ vi: 'Sân Tennis Câu Lạc Bộ', en: 'Club Tennis Courts' }); },
    get subtitle() { return sourceText({ vi: 'Kỹ thuật · Bộ chân · Đánh đôi', en: 'Technique · Footwork · Doubles' }); },
    image: '/images/fitness/tennis-court.jpg',
    programs: [
      { code: '01', get title() { return sourceText({ vi: 'Nhập Môn & Cầm Vợt', en: 'Grip & Fundamentals' }); }, get tag() { return sourceText({ vi: 'Cảm giác bóng cơ bản', en: 'Ball control basics' }); } },
      { code: '02', get title() { return sourceText({ vi: 'Giao Bóng & Lên Lưới', en: 'Serve & Volley' }); }, tag: 'Forehand · Backhand · Serve' },
      { code: '03', get title() { return sourceText({ vi: 'Bộ Chân & Đánh Đôi', en: 'Footwork & Doubles' }); }, get tag() { return sourceText({ vi: 'Giao lưu cuối tuần', en: 'Weekend doubles play' }); } },
    ],
  },
  badminton: {
    id: 'badminton',
    path: '/badminton',
    get label() { return sourceText({ vi: 'Cầu Lông', en: 'Badminton' }); },
    club: 'Badminton Club',
    kicker: 'BADMINTON CLUB',
    get title() { return sourceText({ vi: 'Sân Cầu Lông', en: 'Badminton Courts' }); },
    get subtitle() { return sourceText({ vi: 'Kỹ thuật · Bộ chân · Đánh đôi', en: 'Technique · Footwork · Doubles' }); },
    image: '/images/fitness/badminton-court.webp',
    programs: [
      { code: '01', get title() { return sourceText({ vi: 'Cầm Vợt & Cú Đánh Cơ Bản', en: 'Grip & Basic Strokes' }); }, get tag() { return sourceText({ vi: 'Dành cho người mới', en: 'For beginners' }); } },
      { code: '02', get title() { return sourceText({ vi: 'Bộ Chân & Phản Xạ', en: 'Footwork & Reflexes' }); }, get tag() { return sourceText({ vi: 'Di chuyển nhanh trên sân', en: 'Fast court coverage' }); } },
      { code: '03', get title() { return sourceText({ vi: 'Thi Đấu Đôi', en: 'Doubles Strategy' }); }, get tag() { return sourceText({ vi: 'Giao lưu theo cặp', en: 'Partner coordination' }); } },
    ],
  },
  yoga: {
    id: 'yoga',
    path: '/yoga',
    label: 'Yoga',
    club: 'Yoga Studio',
    kicker: 'YOGA STUDIO',
    get title() { return sourceText({ vi: 'Phòng Tập Yoga', en: 'Zen Garden Yoga Studio' }); },
    get subtitle() { return sourceText({ vi: 'Hơi thở · Thăng bằng · Linh hoạt', en: 'Breath · Balance · Mobility' }); },
    image: '/images/yoga-aerial-silk-studio.jpg',
    programs: [
      { code: '01', get title() { return sourceText({ vi: 'Hơi Thở & Tư Thế', en: 'Breath & Alignment' }); }, get tag() { return sourceText({ vi: 'Dành cho người mới', en: 'For beginners' }); } },
      { code: '02', get title() { return sourceText({ vi: 'Thăng Bằng & Linh Hoạt', en: 'Balance & Flexibility' }); }, get tag() { return sourceText({ vi: 'Hatha & Vinyasa Flow', en: 'Hatha & Vinyasa Flow' }); } },
      { code: '03', get title() { return sourceText({ vi: 'Giãn Cơ & Thư Giãn', en: 'Stretch & Restore' }); }, get tag() { return sourceText({ vi: 'Giải tỏa căng thẳng', en: 'Deep stress relief' }); } },
    ],
  },
};

export const SPORT_PAGE_LIST: SportPageData[] = [
  SPORT_PAGES.swimming,
  SPORT_PAGES.boxing,
  SPORT_PAGES.tennis,
  SPORT_PAGES.badminton,
  SPORT_PAGES.yoga,
];

/** Chuẩn hóa đường dẫn `/boxing` hoặc `/sports/boxing` thành SportPageId hợp lệ. */
export function sportIdFromPath(pathname: string): SportPageId | undefined {
  const segment = pathname.trim().toLowerCase().replace(/^\/(sports\/)?/, '').split('/')[0];
  return segment in SPORT_PAGES ? (segment as SportPageId) : undefined;
}
