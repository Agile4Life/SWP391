import type { RenewalCandidate } from './receptionApi';

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Chỉ tính phạm vi hiển thị; không thay kỳ gửi API gia hạn hoặc hủy. */
export function subscriptionDates(periods: readonly RenewalCandidate[], today: string) {
  const valid = (item: RenewalCandidate) => item.status.toLowerCase() === 'active'
    && validDate(item.startDate) && validDate(item.endDate) && item.startDate <= item.endDate;
  if (!validDate(today)) return null;
  const running = periods.filter(item => valid(item) && item.startDate <= today && today <= item.endDate)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const current = running[0];
  if (!current || running.filter(item => item.endDate === current.endDate).length !== 1) return null;
  let tail = current;
  const visited = new Set<number>();
  // Giống phạm vi Member: chỉ nối kỳ active cùng gói bắt đầu ngay sau kỳ trước.
  while (!visited.has(tail.id)) {
    visited.add(tail.id);
    const children = periods.filter(item => item.previousSubscriptionId === tail.id
      && item.status.toLowerCase() === 'active');
    if (children.length !== 1) break;
    const next = children[0];
    const nextDay = new Date(`${tail.endDate}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    if (visited.has(next.id) || !valid(next) || next.memberId !== current.memberId
      || next.packageId !== current.packageId || next.startDate !== nextDay.toISOString().slice(0, 10)) break;
    tail = next;
  }
  return { current, paidThroughDate: tail.endDate };
}
