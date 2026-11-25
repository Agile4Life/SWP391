import { getIntlLocale, getLanguage } from '../i18n/language';
import type { MembershipPackage } from '../../features/member/membershipApi';

const priceFormatters = new Map<string, Intl.NumberFormat>();

/** Định dạng số tiền theo VND và ngôn ngữ hiện tại (cache Intl.NumberFormat theo locale). */
export const formatPrice = (price: number) => {
  const locale = getIntlLocale();
  let formatter = priceFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' });
    priceFormatters.set(locale, formatter);
  }
  return formatter.format(price);
};

const SEEDED_PACKAGE_NAME_EN: Readonly<Record<string, string>> = {
  'Gói Trải Nghiệm 3 Ngày': '3-Day Trial Pass',
  'SILVER 3 THÁNG': 'SILVER 3 MONTHS',
  'GOLD 3 THÁNG': 'GOLD 3 MONTHS',
  'PLATINUM 3 THÁNG': 'PLATINUM 3 MONTHS',
  'SILVER 6 THÁNG': 'SILVER 6 MONTHS',
  'GOLD 6 THÁNG': 'GOLD 6 MONTHS',
  'PLATINUM 6 THÁNG': 'PLATINUM 6 MONTHS',
  'SILVER 12 THÁNG': 'SILVER 12 MONTHS',
  'GOLD 12 THÁNG': 'GOLD 12 MONTHS',
  'PLATINUM 12 THÁNG': 'PLATINUM 12 MONTHS',
};

const SEEDED_PACKAGE_LINE_EN: Readonly<Record<string, string>> = {
  // Tiêu đề & dẫn nhập gói trải nghiệm và gói 1 tháng (legacy)
  'GÓI TRẢI NGHIỆM – Khám phá SÖL Fitness trong 3 ngày': 'TRIAL PASS – Explore SÖL Fitness for 3 days',
  'BASIC – Cơ bản': 'BASIC – Essential',
  'STANDARD – Trung cấp': 'STANDARD – Intermediate',
  'VIP – Cao cấp': 'VIP – Executive',
  'Toàn bộ quyền lợi Silver, cộng thêm:': 'All Silver benefits, plus:',
  'Toàn bộ quyền lợi Gold, cộng thêm:': 'All Gold benefits, plus:',

  // Tiêu đề 6 gói 3 tháng & 6 tháng đang bán (khớp CatalogSeeder.java)
  'BASIC – Đồng hành 3 tháng': 'BASIC – 3-month commitment',
  'BASIC – Đồng hành 6 tháng (Tiết kiệm ~10%)': 'BASIC – 6-month commitment (Save ~10%)',
  'STANDARD – Gym + PT 1:1 & Giáo án (3 tháng)': 'STANDARD – Gym + 1:1 PT & Training Plan (3 months)',
  'STANDARD – Gym + PT 1:1 & Giáo án (6 tháng · Tiết kiệm ~10%)': 'STANDARD – Gym + 1:1 PT & Training Plan (6 months · Save ~10%)',
  'VIP – Gym + PT 1:1 chuyên sâu (3 tháng)': 'VIP – Gym + Intensive 1:1 PT (3 months)',
  'VIP – Gym + PT 1:1 chuyên sâu (6 tháng · Tiết kiệm ~10%)': 'VIP – Gym + Intensive 1:1 PT (6 months · Save ~10%)',

  // Quyền lợi gói 3 tháng & 6 tháng (SILVER / GOLD / PLATINUM)
  'Tập luyện Gym không giới hạn trong giờ hoạt động suốt 90 ngày.': 'Unlimited gym access during operating hours for 90 days.',
  'Tập luyện Gym không giới hạn trong giờ hoạt động suốt 180 ngày.': 'Unlimited gym access during operating hours for 180 days.',
  'Check-in ra/vào bằng thẻ QR động.': 'Check in and out with your dynamic QR card.',
  'Sử dụng đầy đủ khu vực tạ tự do, máy cardio và máy tập tiêu chuẩn.': 'Full access to free weights, cardio machines, and standard gym equipment.',
  'Sử dụng phòng thay đồ, tủ khóa chung và miễn phí nước uống.': 'Changing rooms, shared lockers, and complimentary drinking water.',
  'Hỗ trợ bảo lưu tối đa 07 ngày (khi có lý do hợp lệ).': 'Membership freeze support up to 7 days (with a valid reason).',
  'Có thể đặt thêm buổi tập PT 1:1 tính phí theo giờ khi có nhu cầu.': 'Option to book additional pay-per-session 1:1 Personal Training as needed.',
  'Tặng 09 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).': 'Includes 9 Personal Trainer 1:1 sessions (3 sessions per 30-day cycle).',
  'Tặng 18 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).': 'Includes 18 Personal Trainer 1:1 sessions (3 sessions per 30-day cycle).',
  'Được Huấn luyện viên xây dựng Giáo án tập luyện cá nhân hóa.': 'Personalized training plan built by your coach.',
  'Được Huấn luyện viên xây dựng và điều chỉnh Giáo án tập luyện cá nhân hóa.': 'Personalized training plan built and adjusted by your coach.',
  'Sử dụng tủ khóa cố định và khăn tập mỗi buổi.': 'Dedicated personal locker and fresh workout towel every visit.',
  'Hỗ trợ bảo lưu tối đa 15 ngày.': 'Membership freeze support up to 15 days.',
  'Giảm 10% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.': '10% off additional 1:1 Personal Training sessions beyond your included quota.',
  'Tặng 18 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).': 'Includes 18 Personal Trainer 1:1 sessions (6 sessions per 30-day cycle).',
  'Tặng 36 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).': 'Includes 36 Personal Trainer 1:1 sessions (6 sessions per 30-day cycle).',
  'Thiết kế Giáo án tập luyện chuyên sâu theo mục tiêu từng giai đoạn.': 'In-depth training program tailored to your goals at each stage.',
  'Tủ đồ cá nhân cao cấp có khóa riêng, khăn tập & khăn tắm VIP.': 'Premium private locker, VIP workout towel, and bath towel service.',
  'Hỗ trợ bảo lưu tối đa 30 ngày.': 'Membership freeze support up to 30 days.',
  'Giảm 20% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.': '20% off additional 1:1 Personal Training sessions beyond your included quota.',

  // Quyền lợi gói trải nghiệm 3 ngày & gói 1 tháng (legacy)
  'Nhận các dịch vụ của gói Gold (không gồm phòng VIP).': 'Access Gold tier services (excluding VIP studio).',
  'Nhận các dịch vụ của gói Gold.': 'Access Gold tier services.',
  'Không áp dụng chính sách bảo lưu.': 'Membership hold policies do not apply.',
  'Giảm 10% dịch vụ PT bổ sung.': '10% off extra PT sessions.',
  'Giảm 20% dịch vụ PT bổ sung.': '20% off extra PT sessions.',
  'Toàn quyền sử dụng khu vực gym tiêu chuẩn và trang thiết bị hiện đại.': 'Full access to the standard gym floor and modern training equipment.',
  '01 buổi tập Personal Trainer 1:1 cùng Huấn luyện viên chuyên nghiệp.': '1 Personal Trainer 1:1 session with a certified coach.',
  'Sử dụng tủ khóa và tiện ích phòng thay đồ.': 'Locker room and changing amenities included.',
  'Không đăng ký lớp Group Fitness và không áp dụng chính sách bảo lưu.': 'Group Fitness enrollment and membership hold policies do not apply.',
  'Tập luyện không giới hạn trong giờ hoạt động.': 'Unlimited gym access during operating hours.',
  'Sử dụng khu vực tập luyện tiêu chuẩn.': 'Access to the standard training floor.',
  'Sử dụng phòng thay đồ và tủ khóa chung.': 'Access to changing rooms and shared lockers.',
  'Miễn phí nước uống.': 'Complimentary drinking water.',
  '1 lượt đăng ký khóa Group Fitness cơ bản theo lịch.': '1 scheduled Group Fitness course enrollment.',
  '03 buổi tập Personal Trainer 1:1 mỗi tháng.': '3 Personal Trainer 1:1 sessions per month.',
  'Sử dụng khu vực máy tập nâng cao.': 'Access to the advanced equipment zone.',
  'Cung cấp khăn tập riêng trong mỗi buổi tập.': 'Fresh workout towel provided every visit.',
  'Tủ khóa cá nhân cố định.': 'Dedicated personal locker.',
  'Xây dựng kế hoạch tập luyện cá nhân cơ bản.': 'Foundational personalized workout plan.',
  '2 lượt đăng ký khóa Group Fitness.': '2 Group Fitness course enrollments.',
  '06 buổi tập Personal Trainer 1:1 mỗi tháng.': '6 Personal Trainer 1:1 sessions per month.',
  'Đặc quyền sử dụng phòng tập VIP riêng biệt.': 'Exclusive access to the private VIP Platinum gym.',
  'Sử dụng hệ thống máy tập cao cấp và thiết bị chuyên biệt.': 'Access to flagship machines and specialized training rigs.',
  'Khăn tập và khăn tắm cá nhân theo tiêu chuẩn VIP.': 'VIP-grade workout and bath towel service.',
  'Tủ đồ cá nhân cao cấp, có khóa riêng.': 'Premium private locker.',
  'Sử dụng phòng xông hơi.': 'Thermal sauna access.',
  'Miễn phí nước khoáng và đồ uống thể thao.': 'Complimentary mineral water and sports drinks.',
  'Thiết kế giáo án tập luyện riêng theo mục tiêu.': 'Goal-tailored training program design.',
  'Tư vấn dinh dưỡng cơ bản cùng huấn luyện viên.': 'Foundational nutrition guidance with your coach.',
  '4 lượt đăng ký khóa Group Fitness.': '4 Group Fitness course enrollments.',
  'Được mời tham gia các sự kiện và chương trình độc quyền.': 'Invitations to exclusive member events and workshops.',

  // Các dòng seed 3 tháng trước đây còn có thể xuất hiện trên lịch sử đăng ký cũ
  'BASIC – Đồng hành 3 tháng (Tiết kiệm 8%)': 'BASIC – 3-month commitment (Save 8%)',
  'STANDARD – Đồng hành 3 tháng (Tiết kiệm 11%)': 'STANDARD – 3-month commitment (Save 11%)',
  'VIP – Đồng hành 3 tháng (Tiết kiệm 11%)': 'VIP – 3-month commitment (Save 11%)',
  'Tập luyện không giới hạn trong giờ hoạt động suốt 90 ngày.': 'Unlimited gym access during operating hours for 90 days.',
  'Sử dụng khu vực tập luyện tiêu chuẩn, phòng thay đồ và tủ khóa chung.': 'Access to the standard gym floor, changing rooms, and shared lockers.',
  '3 lượt đăng ký khóa Group Fitness cơ bản theo lịch.': '3 scheduled Group Fitness course enrollments.',
  '09 buổi tập Personal Trainer 1:1 trong 3 tháng.': '9 Personal Trainer 1:1 sessions across 3 months.',
  'Sử dụng khu vực máy tập nâng cao và khăn tập riêng mỗi buổi.': 'Advanced equipment zone access and workout towel service every visit.',
  '6 lượt đăng ký khóa Group Fitness.': '6 Group Fitness course enrollments.',
  '18 buổi tập Personal Trainer 1:1 trong 3 tháng.': '18 Personal Trainer 1:1 sessions across 3 months.',
  'Đặc quyền sử dụng phòng tập VIP riêng biệt và phòng xông hơi.': 'Exclusive access to the private VIP Platinum gym and sauna.',
  'Khăn tập, khăn tắm và tủ đồ cá nhân cao cấp.': 'VIP workout towels, bath towels, and premium private locker.',
  'Giáo án tập luyện riêng và tư vấn dinh dưỡng cơ bản.': 'Tailored training program and foundational nutrition guidance.',
  '12 lượt đăng ký khóa Group Fitness.': '12 Group Fitness course enrollments.',
};

/** Dịch tên gói mẫu sang tiếng Anh khi đang ở bản tiếng Anh (gói không có bản dịch thì giữ nguyên). */
export function localizeSeededPackageName(name: string, lang: 'vi' | 'en' = getLanguage()): string {
  if (!name || lang !== 'en') return name;
  return SEEDED_PACKAGE_NAME_EN[name.trim()] ?? name;
}

/** Dịch một dòng mô tả gói mẫu sang tiếng Anh khi đang ở bản tiếng Anh. */
function localizeSeededPackageLine(line: string, lang: 'vi' | 'en'): string {
  if (!line || lang !== 'en') return line;
  return SEEDED_PACKAGE_LINE_EN[line.trim()] ?? line;
}

/** True nếu là gói trải nghiệm (miễn phí 3 ngày hoặc tên có "trải nghiệm"/"trial"). */
export function isTrialPackage(pkg: { price?: number; durationDays?: number; name?: string }): boolean {
  if (pkg.price === 0 && pkg.durationDays === 3) return true;
  const name = (pkg.name || '').toLowerCase();
  return name.includes('trải nghiệm') || name.includes('trial');
}

// Quy tắc thời hạn bán gói (khớp PackageService.MIN_TERM_DAYS ở backend), dùng chung cho landing và trang hội viên.
export const MIN_TERM_DAYS = 90;
export const LONG_TERM_DAYS = 180;

// Hiển thị quyền lợi thật từ catalog; không tự sửa quyền lợi để khớp scope Gym ở frontend.
export function getPackageDetails(pkg: MembershipPackage, lang: 'vi' | 'en' = getLanguage()) {
  // Chọn chuỗi theo ngôn ngữ hiển thị.
  const t = (vi: string, en: string) => lang === 'en' ? en : vi;
  const desc = pkg.description?.trim() || '';
  const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean);

  // Trích xuất các dòng gạch đầu dòng nếu có (các dòng bắt đầu bằng '-' hoặc '•')
  const bulletPerks = lines
    .filter((l) => l.startsWith('-') || l.startsWith('•'))
    .map((l) => localizeSeededPackageLine(l.replace(/^[-•]\s*/, '').trim(), lang));

  let summary = localizeSeededPackageLine(desc, lang);
  const firstBulletIdx = lines.findIndex((l) => l.startsWith('-') || l.startsWith('•'));
  if (firstBulletIdx > 0) {
    summary = lines
      .slice(0, firstBulletIdx)
      .filter((l) => !l.toLowerCase().includes('quyền lợi'))
      .map((l) => localizeSeededPackageLine(l, lang))
      .join(' • ');
  } else if (firstBulletIdx === 0) {
    const displayPkgName = localizeSeededPackageName(pkg.name, lang);
    summary = t(`Gói tập ${pkg.name} có thời hạn ${pkg.durationDays} ngày.`, `${displayPkgName} membership lasts ${pkg.durationDays} days.`);
  }

  const defaultBenefits = [
    t(`Hiệu lực ${pkg.durationDays} ngày kể từ khi kích hoạt`, `Valid for ${pkg.durationDays} days from activation`),
    t('Check-in và đặt lịch PT 1:1 khi gói còn hiệu lực', 'Check in and book 1:1 PT sessions while your membership is valid'),
    t('Thanh toán và kích hoạt tại quầy lễ tân', 'Payment and activation at reception'),
  ];

  let tierBadge = t(`Gói tập • ${pkg.durationDays} ngày`, `Membership • ${pkg.durationDays} days`);
  if (pkg.durationDays === 365) {
    tierBadge = t('Gói 12 tháng • 365 ngày', '12-month plan • 365 days');
  } else if (pkg.durationDays === 180) {
    tierBadge = t('Gói 6 tháng • 180 ngày', '6-month plan • 180 days');
  } else if (pkg.durationDays === 90) {
    tierBadge = t('Gói 3 tháng • 90 ngày', '3-month plan • 90 days');
  } else if (pkg.durationDays === 30) {
    tierBadge = t('Gói tháng • 30 ngày', 'Monthly plan • 30 days');
  }

  return {
    tierBadge,
    summary: summary || t(`Gói tập có thời hạn ${pkg.durationDays} ngày.`, `Membership lasts ${pkg.durationDays} days.`),
    benefits: bulletPerks.length > 0 ? bulletPerks : defaultBenefits,
    /** Chỉ các quyền lợi do catalog mô tả (không gồm dòng mặc định) */
    perks: bulletPerks,
  };
}
