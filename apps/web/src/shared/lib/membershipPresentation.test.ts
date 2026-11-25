import { describe, expect, it } from 'vitest';
import { getPackageDetails, isTrialPackage, localizeSeededPackageName } from './membershipPresentation';
import type { MembershipPackage } from '../../features/member/membershipApi';

const VIETNAMESE_DIACRITIC_RE = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1EA0-\u1EF9]/u;

describe('isTrialPackage', () => {
  it.each([
    { name: 'Vé tập một ngày', price: 100000, durationDays: 1 },
    { name: 'Vé cuối tuần', price: 250000, durationDays: 3 },
    { name: 'Gói ưu đãi một tháng', price: 0, durationDays: 30 },
    { name: 'Essential', price: 500000, durationDays: 30 },
  ])('keeps regular package $name available', (pkg) => {
    expect(isTrialPackage(pkg)).toBe(false);
  });

  it.each([
    { name: 'Gói Trải Nghiệm 3 Ngày', price: 0, durationDays: 3 },
    { name: 'Gold Trial', price: 0, durationDays: 3 },
    { name: 'Gói dành cho hội viên mới', price: 0, durationDays: 3 },
  ])('recognizes trial package $name', (pkg) => {
    expect(isTrialPackage(pkg)).toBe(true);
  });
});

// P1-FE-08: Complete English translations for all 6 active seeded 3M & 6M packages from CatalogSeeder.java
describe('seeded 3-month and 6-month package English localization (P1-FE-08)', () => {
  const activeSeededPackages: MembershipPackage[] = [
    {
      id: 1,
      name: 'SILVER 3 THÁNG',
      price: 549000,
      durationDays: 90,
      classCreditLimit: 3,
      status: 'active',
      description:
        'BASIC – Đồng hành 3 tháng\n' +
        'Quyền lợi:\n' +
        '- Tập luyện Gym không giới hạn trong giờ hoạt động suốt 90 ngày.\n' +
        '- Check-in ra/vào bằng thẻ QR động.\n' +
        '- Sử dụng đầy đủ khu vực tạ tự do, máy cardio và máy tập tiêu chuẩn.\n' +
        '- Sử dụng phòng thay đồ, tủ khóa chung và miễn phí nước uống.\n' +
        '- Hỗ trợ bảo lưu tối đa 07 ngày (khi có lý do hợp lệ).\n' +
        '- Có thể đặt thêm buổi tập PT 1:1 tính phí theo giờ khi có nhu cầu.',
    },
    {
      id: 2,
      name: 'SILVER 6 THÁNG',
      price: 990000,
      durationDays: 180,
      classCreditLimit: 6,
      status: 'active',
      description:
        'BASIC – Đồng hành 6 tháng (Tiết kiệm ~10%)\n' +
        'Quyền lợi:\n' +
        '- Tập luyện Gym không giới hạn trong giờ hoạt động suốt 180 ngày.\n' +
        '- Check-in ra/vào bằng thẻ QR động.\n' +
        '- Sử dụng đầy đủ khu vực tạ tự do, máy cardio và máy tập tiêu chuẩn.\n' +
        '- Sử dụng phòng thay đồ, tủ khóa chung và miễn phí nước uống.\n' +
        '- Hỗ trợ bảo lưu tối đa 07 ngày (khi có lý do hợp lệ).\n' +
        '- Có thể đặt thêm buổi tập PT 1:1 tính phí theo giờ khi có nhu cầu.',
    },
    {
      id: 3,
      name: 'GOLD 3 THÁNG',
      price: 799000,
      durationDays: 90,
      classCreditLimit: 6,
      status: 'active',
      description:
        'STANDARD – Gym + PT 1:1 & Giáo án (3 tháng)\n' +
        'Toàn bộ quyền lợi Silver, cộng thêm:\n' +
        '- Tặng 09 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).\n' +
        '- Được Huấn luyện viên xây dựng Giáo án tập luyện cá nhân hóa.\n' +
        '- Sử dụng tủ khóa cố định và khăn tập mỗi buổi.\n' +
        '- Hỗ trợ bảo lưu tối đa 15 ngày.\n' +
        '- Giảm 10% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.',
    },
    {
      id: 4,
      name: 'GOLD 6 THÁNG',
      price: 1449000,
      durationDays: 180,
      classCreditLimit: 12,
      status: 'active',
      description:
        'STANDARD – Gym + PT 1:1 & Giáo án (6 tháng · Tiết kiệm ~10%)\n' +
        'Toàn bộ quyền lợi Silver, cộng thêm:\n' +
        '- Tặng 18 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).\n' +
        '- Được Huấn luyện viên xây dựng và điều chỉnh Giáo án tập luyện cá nhân hóa.\n' +
        '- Sử dụng tủ khóa cố định và khăn tập mỗi buổi.\n' +
        '- Hỗ trợ bảo lưu tối đa 15 ngày.\n' +
        '- Giảm 10% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.',
    },
    {
      id: 5,
      name: 'PLATINUM 3 THÁNG',
      price: 1599000,
      durationDays: 90,
      classCreditLimit: 12,
      status: 'active',
      description:
        'VIP – Gym + PT 1:1 chuyên sâu (3 tháng)\n' +
        'Toàn bộ quyền lợi Gold, cộng thêm:\n' +
        '- Tặng 18 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).\n' +
        '- Thiết kế Giáo án tập luyện chuyên sâu theo mục tiêu từng giai đoạn.\n' +
        '- Tủ đồ cá nhân cao cấp có khóa riêng, khăn tập & khăn tắm VIP.\n' +
        '- Miễn phí nước khoáng và đồ uống thể thao.\n' +
        '- Hỗ trợ bảo lưu tối đa 30 ngày.\n' +
        '- Giảm 20% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.',
    },
    {
      id: 6,
      name: 'PLATINUM 6 THÁNG',
      price: 2899000,
      durationDays: 180,
      classCreditLimit: 24,
      status: 'active',
      description:
        'VIP – Gym + PT 1:1 chuyên sâu (6 tháng · Tiết kiệm ~10%)\n' +
        'Toàn bộ quyền lợi Gold, cộng thêm:\n' +
        '- Tặng 36 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).\n' +
        '- Thiết kế Giáo án tập luyện chuyên sâu theo mục tiêu từng giai đoạn.\n' +
        '- Tủ đồ cá nhân cao cấp có khóa riêng, khăn tập & khăn tắm VIP.\n' +
        '- Miễn phí nước khoáng và đồ uống thể thao.\n' +
        '- Hỗ trợ bảo lưu tối đa 30 ngày.\n' +
        '- Giảm 20% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.',
    },
  ];

  it.each(activeSeededPackages)('translates $name summary and every bullet cleanly into English with zero leftover Vietnamese', (pkg) => {
    const localizedName = localizeSeededPackageName(pkg.name, 'en');
    expect(VIETNAMESE_DIACRITIC_RE.test(localizedName)).toBe(false);

    const details = getPackageDetails(pkg, 'en');
    expect(details.summary.length).toBeGreaterThan(0);
    expect(VIETNAMESE_DIACRITIC_RE.test(details.summary)).toBe(false);
    expect(details.perks.length).toBeGreaterThan(0);
    for (const perk of details.perks) {
      expect(VIETNAMESE_DIACRITIC_RE.test(perk)).toBe(false);
    }
  });

  it('does not include obsolete shop or body-metrics translation lines', () => {
    const retiredPkg: MembershipPackage = {
      id: 99,
      name: 'LEGACY',
      price: 500000,
      durationDays: 90,
      classCreditLimit: 1,
      status: 'inactive',
      description:
        '- Đánh giá thể trạng và chỉ số BMI ban đầu.\n' +
        '- Giảm 10% dịch vụ PT bổ sung và sản phẩm tại trung tâm.',
    };
    const details = getPackageDetails(retiredPkg, 'en');
    expect(details.perks).toEqual([
      'Đánh giá thể trạng và chỉ số BMI ban đầu.',
      'Giảm 10% dịch vụ PT bổ sung và sản phẩm tại trung tâm.',
    ]);
  });
});

// P2-FE-20: Exact duration badge matching and no hardcoded "Save 25%" claim
describe('getPackageDetails duration badges (P2-FE-20)', () => {
  const makePkg = (durationDays: number): MembershipPackage => ({
    id: durationDays,
    name: `PLAN ${durationDays}`,
    price: 500000,
    durationDays,
    classCreditLimit: 3,
    status: 'active',
    description: '',
  });

  it('uses exact standard labels without hardcoded Save 25% claims', () => {
    expect(getPackageDetails(makePkg(365), 'vi').tierBadge).toBe('Gói 12 tháng • 365 ngày');
    expect(getPackageDetails(makePkg(365), 'en').tierBadge).toBe('12-month plan • 365 days');
    expect(getPackageDetails(makePkg(180), 'vi').tierBadge).toBe('Gói 6 tháng • 180 ngày');
    expect(getPackageDetails(makePkg(90), 'en').tierBadge).toBe('3-month plan • 90 days');
    expect(getPackageDetails(makePkg(30), 'en').tierBadge).toBe('Monthly plan • 30 days');
  });

  it('interpolates actual durationDays for custom durations instead of mislabeling them', () => {
    expect(getPackageDetails(makePkg(360), 'vi').tierBadge).toBe('Gói tập • 360 ngày');
    expect(getPackageDetails(makePkg(360), 'en').tierBadge).toBe('Membership • 360 days');
    expect(getPackageDetails(makePkg(175), 'vi').tierBadge).toBe('Gói tập • 175 ngày');
    expect(getPackageDetails(makePkg(200), 'en').tierBadge).toBe('Membership • 200 days');
  });
});
