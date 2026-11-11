import { memberText } from '../member/memberI18n';
import type { CourtQuota } from './courtsApi';

/**
 * Quy định đặt sân của gói đang dùng. Mọi số liệu lấy từ API (/court-bookings/quota, nguồn duy nhất là
 * PackageBenefits ở backend) nên không lệch với những gì máy chủ thật sự chặn.
 */
export function CourtPolicyCard({ quota }: { quota: CourtQuota | null }) {
  if (!quota || !quota.packageName) return null;
  const leadHours = Math.round(quota.releaseLeadMinutes / 60);
  return <section className="portal-card court-policy" aria-labelledby="court-policy-title">
    <h2 id="court-policy-title" className="portal-card-title">{memberText(`Quy định đặt sân của gói ${quota.packageName}`, `Court booking rules for ${quota.packageName}`)}</h2>
    <ul className="court-policy__list">
      <li>{memberText(`Gói gồm ${quota.monthlyQuota} lượt đặt sân miễn phí mỗi chu kỳ 30 ngày (đã dùng ${quota.used}); lượt thêm tính phí theo giờ.`, `Your plan includes ${quota.monthlyQuota} free court bookings per 30-day cycle (${quota.used} used); extra bookings are charged per hour.`)}</li>
      <li>{memberText(`Đặt trước tối đa ${quota.advanceDays} ngày.`, `Book up to ${quota.advanceDays} days ahead.`)}</li>
      <li>{memberText(`Tối đa ${quota.maxUpcoming} lượt chưa diễn ra cùng lúc (hiện có ${quota.upcoming}).`, `At most ${quota.maxUpcoming} upcoming bookings at once (${quota.upcoming} now).`)}</li>
      <li>{memberText(`Tối đa ${quota.maxUnpaid} lượt chưa thanh toán cùng lúc (hiện giữ ${quota.unpaid}). VNPay giữ chỗ 15 phút; tiền mặt tại quầy giữ chỗ đến ${leadHours} giờ trước giờ bắt đầu, sau đó chỗ được trả lại.`, `At most ${quota.maxUnpaid} unpaid bookings at once (${quota.unpaid} held). VNPay holds a slot for 15 minutes; counter payment holds it until ${leadHours} hours before the start, then the slot is released.`)}</li>
      <li>{memberText('Hủy trước giờ bắt đầu ít nhất 2 giờ.', 'Cancel at least 2 hours before the start.')}</li>
    </ul>
  </section>;
}
