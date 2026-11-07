import { centerNowParts } from '../../shared/lib/centerTime';

export function cardStatus(status: string, endDate: string, today = new Date()) {
  if (status === 'expired') return 'expired';
  if (status !== 'active' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 'inactive';
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  if (end.getUTCFullYear() !== year || end.getUTCMonth() !== month - 1 || end.getUTCDate() !== day) return 'inactive';
  const [todayYear, todayMonth, todayDay] = centerNowParts(today).date.split('-').map(Number);
  const remaining = (Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000;
  if (remaining < 0) return 'expired';
  return remaining < 7 ? 'warning' : 'active';
}
