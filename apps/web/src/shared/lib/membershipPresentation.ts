import { getIntlLocale, getLanguage } from '../i18n/language';
import type { MembershipPackage } from '../../features/member/membershipApi';

export const formatPrice = (price: number) => new Intl.NumberFormat(getIntlLocale(), {
  style: 'currency', currency: 'VND',
}).format(price);

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
  'GÓI TRẢI NGHIỆM – Khám phá SÖL Fitness trong 3 ngày': 'TRIAL PASS – Explore SÖL Fitness for 3 days',
  'BASIC – Cơ bản': 'BASIC – Essential',
  'STANDARD – Trung cấp': 'STANDARD – Intermediate',
  'VIP – Cao cấp': 'VIP – Executive',
  'BASIC – Đồng hành 3 tháng (Tiết kiệm 8%)': 'BASIC – 3-month commitment (Save 8%)',
  'STANDARD – Đồng hành 3 tháng (Tiết kiệm 11%)': 'STANDARD – 3-month commitment (Save 11%)',
  'VIP – Đồng hành 3 tháng (Tiết kiệm 11%)': 'VIP – 3-month commitment (Save 11%)',
  'Nhận các dịch vụ của gói Gold (không gồm phòng VIP).': 'Access Gold tier services (excluding VIP studio).',
  'Toàn quyền sử dụng khu vực gym tiêu chuẩn và trang thiết bị hiện đại.': 'Full access to the standard gym floor and modern training equipment.',
  '01 buổi tập Personal Trainer 1:1 cùng Huấn luyện viên chuyên nghiệp.': '1 Personal Trainer 1:1 session with a certified coach.',
  'Sử dụng tủ khóa và tiện ích phòng thay đồ.': 'Locker room and changing amenities included.',
  'Không đăng ký lớp Group Fitness và không áp dụng chính sách bảo lưu.': 'Group Fitness enrollment and membership hold policies do not apply.',
  'Tập luyện không giới hạn trong giờ hoạt động.': 'Unlimited gym access during operating hours.',
  'Sử dụng khu vực tập luyện tiêu chuẩn.': 'Access to the standard training floor.',
  'Sử dụng phòng thay đồ và tủ khóa chung.': 'Access to changing rooms and shared lockers.',
  'Miễn phí nước uống.': 'Complimentary drinking water.',
  '1 lượt đăng ký khóa Group Fitness cơ bản theo lịch.': '1 scheduled Group Fitness course enrollment.',
  'Đánh giá thể trạng và chỉ số BMI ban đầu.': 'Initial fitness and BMI assessment.',
  '03 buổi tập Personal Trainer 1:1 mỗi tháng.': '3 Personal Trainer 1:1 sessions per month.',
  'Sử dụng khu vực máy tập nâng cao.': 'Access to the advanced equipment zone.',
  'Cung cấp khăn tập riêng trong mỗi buổi tập.': 'Fresh workout towel provided every visit.',
  'Tủ khóa cá nhân cố định.': 'Dedicated personal locker.',
  'Được đánh giá thể trạng định kỳ mỗi tháng.': 'Monthly fitness progress assessments.',
  'Xây dựng kế hoạch tập luyện cá nhân cơ bản.': 'Foundational personalized workout plan.',
  '2 lượt đăng ký khóa Group Fitness.': '2 Group Fitness course enrollments.',
  'Giảm 10% dịch vụ PT bổ sung và sản phẩm tại trung tâm.': '10% off extra PT sessions and SÖL shop products.',
  '06 buổi tập Personal Trainer 1:1 mỗi tháng.': '6 Personal Trainer 1:1 sessions per month.',
  'Đặc quyền sử dụng phòng tập VIP riêng biệt.': 'Exclusive access to the private VIP Platinum gym.',
  'Sử dụng hệ thống máy tập cao cấp và thiết bị chuyên biệt.': 'Access to flagship machines and specialized training rigs.',
  'Khăn tập và khăn tắm cá nhân theo tiêu chuẩn VIP.': 'VIP-grade workout and bath towel service.',
  'Tủ đồ cá nhân cao cấp, có khóa riêng.': 'Premium private locker.',
  'Sử dụng phòng xông hơi.': 'Thermal sauna access.',
  'Miễn phí nước khoáng và đồ uống thể thao.': 'Complimentary mineral water and sports drinks.',
  'Đánh giá chỉ số cơ thể chuyên sâu: BMI, Body Fat, Muscle Mass.': 'In-depth body composition scan: BMI, Body Fat, and Muscle Mass.',
  'Thiết kế giáo án tập luyện riêng theo mục tiêu.': 'Goal-tailored training program design.',
  'Tư vấn dinh dưỡng cơ bản cùng huấn luyện viên.': 'Foundational nutrition guidance with your coach.',
  '4 lượt đăng ký khóa Group Fitness.': '4 Group Fitness course enrollments.',
  'Giảm 20% dịch vụ PT bổ sung và sản phẩm tại trung tâm.': '20% off extra PT sessions and SÖL shop products.',
  'Được mời tham gia các sự kiện và chương trình độc quyền.': 'Invitations to exclusive member events and workshops.',
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

export function localizeSeededPackageName(name: string, lang: 'vi' | 'en' = getLanguage()): string {
  if (!name || lang !== 'en') return name;
  return SEEDED_PACKAGE_NAME_EN[name.trim()] ?? name;
}

function localizeSeededPackageLine(line: string, lang: 'vi' | 'en'): string {
  if (!line || lang !== 'en') return line;
  return SEEDED_PACKAGE_LINE_EN[line.trim()] ?? line;
}

export function isTrialPackage(pkg: { price?: number; durationDays?: number; name?: string }): boolean {
  if (pkg.price === 0 && pkg.durationDays === 3) return true;
  const name = (pkg.name || '').toLowerCase();
  return name.includes('trải nghiệm') || name.includes('trial');
}

export function getPackageDetails(pkg: MembershipPackage, lang: 'vi' | 'en' = getLanguage()) {
  const t = (vi: string, en: string) => lang === 'en' ? en : vi;
  const desc = pkg.description?.trim() || '';
  const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean);

  // Extract bullet points if present (lines starting with '-' or '•')
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
    pkg.classCreditLimit != null ? t(`Tối đa ${pkg.classCreditLimit} lượt đặt lớp mỗi kỳ`, `Up to ${pkg.classCreditLimit} class bookings per period`) : t('Không giới hạn lượt đặt lớp', 'Unlimited class bookings'),
    t('Đặt lớp và check-in khi gói còn hiệu lực', 'Book classes and check in while your membership is valid'),
    t('Thanh toán và kích hoạt tại quầy lễ tân', 'Payment and activation at reception'),
  ];

  let tierBadge = t(`Gói tập • ${pkg.durationDays} ngày`, `Membership • ${pkg.durationDays} days`);
  if (pkg.durationDays >= 360) {
    tierBadge = t(`Gói 12 tháng • 365 ngày (Tiết kiệm 25%)`, `12-month plan • 365 days (Save 25%)`);
  } else if (pkg.durationDays >= 170) {
    tierBadge = t(`Gói 6 tháng • 180 ngày (Tiết kiệm ~17%)`, `6-month plan • 180 days (Save ~17%)`);
  } else if (pkg.durationDays === 90) {
    tierBadge = t(`Gói 3 tháng • 90 ngày`, `3-month plan • 90 days`);
  } else if (pkg.durationDays === 30) {
    tierBadge = t(`Gói tháng • 30 ngày`, `Monthly plan • 30 days`);
  }

  return {
    tierBadge,
    summary: summary || t(`Gói tập có thời hạn ${pkg.durationDays} ngày.`, `Membership lasts ${pkg.durationDays} days.`),
    benefits: bulletPerks.length > 0 ? bulletPerks : defaultBenefits,
    /** Chỉ các quyền lợi do catalog mô tả (không gồm dòng mặc định) */
    perks: bulletPerks,
  };
}
