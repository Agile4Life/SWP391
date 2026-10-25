import type { MembershipPackage } from '../../features/member/membershipApi';

export const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND',
}).format(price);

export function getPackageDetails(pkg: MembershipPackage) {
  return {
    tierBadge: `Gói tập • ${pkg.durationDays} ngày`,
    summary: pkg.description?.trim() || `Gói tập có thời hạn ${pkg.durationDays} ngày.`,
    benefits: [
      `Hiệu lực ${pkg.durationDays} ngày kể từ khi kích hoạt`,
      pkg.classCreditLimit != null ? `Tối đa ${pkg.classCreditLimit} lượt đặt lớp mỗi kỳ` : 'Không giới hạn lượt đặt lớp',
      'Đặt lớp và check-in khi gói còn hiệu lực',
      'Thanh toán và kích hoạt tại quầy lễ tân',
    ],
  };
}
