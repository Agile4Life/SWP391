import type { MembershipPackage } from '../../features/member/membershipApi';

export const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND',
}).format(price);

export function getPackageDetails(pkg: MembershipPackage) {
  const desc = pkg.description?.trim() || '';
  const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean);

  // Extract bullet points if present (lines starting with '-' or '•')
  const bulletPerks = lines
    .filter((l) => l.startsWith('-') || l.startsWith('•'))
    .map((l) => l.replace(/^[-•]\s*/, '').trim());

  let summary = desc;
  const firstBulletIdx = lines.findIndex((l) => l.startsWith('-') || l.startsWith('•'));
  if (firstBulletIdx > 0) {
    summary = lines.slice(0, firstBulletIdx).filter((l) => !l.toLowerCase().includes('quyền lợi')).join(' • ');
  } else if (firstBulletIdx === 0) {
    summary = `Gói tập ${pkg.name} có thời hạn ${pkg.durationDays} ngày.`;
  }

  const defaultBenefits = [
    `Hiệu lực ${pkg.durationDays} ngày kể từ khi kích hoạt`,
    pkg.classCreditLimit != null ? `Tối đa ${pkg.classCreditLimit} lượt đặt lớp mỗi kỳ` : 'Không giới hạn lượt đặt lớp',
    'Đặt lớp và check-in khi gói còn hiệu lực',
    'Thanh toán và kích hoạt tại quầy lễ tân',
  ];

  return {
    tierBadge: `Gói tập • ${pkg.durationDays} ngày`,
    summary: summary || `Gói tập có thời hạn ${pkg.durationDays} ngày.`,
    benefits: bulletPerks.length > 0 ? bulletPerks : defaultBenefits,
  };
}
