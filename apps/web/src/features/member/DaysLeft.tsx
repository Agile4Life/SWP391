import { centerNowParts } from '../../shared/lib/centerTime';
import { memberText } from './memberI18n';

/** Số ngày còn lại tính theo lịch trung tâm (gồm cả ngày hết hạn). Âm/0 nghĩa là đã hết hạn. */
function daysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${centerNowParts().date}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(today)) return null;
  return Math.round((end - today) / 86_400_000) + 1;
}

/** Chip "Còn N ngày": trung tính khi còn nhiều, vàng khi ≤ 7 ngày, đỏ khi ≤ 2 ngày hoặc đã hết hạn. */
export function DaysLeft({ endDate }: { endDate: string | null | undefined }) {
  const days = daysLeft(endDate);
  if (days === null) return null;
  const tone = days <= 0 ? 'danger' : days <= 2 ? 'danger' : days <= 7 ? 'warn' : 'ok';
  const label = days <= 0 ? memberText('Đã hết hạn', 'Expired') : memberText(`Còn ${days} ngày`, `${days} days left`);
  return <span className={`days-left days-left--${tone}`}>{label}</span>;
}
