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
  boxing: {
    id: 'boxing',
    path: '/boxing',
    label: 'Boxing',
    get club() { return sourceText({ vi: 'Câu lạc bộ Boxing', en: 'Boxing Club' }); },
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
  yoga: {
    id: 'yoga',
    path: '/yoga',
    label: 'Yoga',
    get club() { return sourceText({ vi: 'Phòng tập Yoga', en: 'Yoga Studio' }); },
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
  SPORT_PAGES.boxing,
  SPORT_PAGES.yoga,
];

/** Chuẩn hóa đường dẫn `/boxing` hoặc `/sports/boxing` thành SportPageId hợp lệ. */
export function sportIdFromPath(pathname: string): SportPageId | undefined {
  const segment = pathname.trim().toLowerCase().replace(/^\/(sports\/)?/, '').split('/')[0];
  return segment in SPORT_PAGES ? (segment as SportPageId) : undefined;
}
