export function cardStatus(status: string, endDate: string, today = new Date()) {
  if (status === 'expired') return 'expired';
  if (status !== 'active' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 'inactive';
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  if (end.getFullYear() !== year || end.getMonth() !== month - 1 || end.getDate() !== day) return 'inactive';
  const remaining = (Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000;
  if (remaining < 0) return 'expired';
  return remaining < 7 ? 'warning' : 'active';
}
