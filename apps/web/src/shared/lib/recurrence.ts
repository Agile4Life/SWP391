/** Date helpers on ISO yyyy-MM-dd strings, computed at UTC noon so no timezone can shift the day. */
const utcNoon = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

export function addDays(date: string, days: number): string {
  const value = utcNoon(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
