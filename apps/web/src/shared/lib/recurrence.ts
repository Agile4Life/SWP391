const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date helpers on ISO yyyy-MM-dd strings, computed at UTC noon so no timezone can shift the day. */
function utcNoon(date: string): Date | null {
  const match = ISO_DATE_RE.exec(date.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const parsed = new Date(Date.UTC(y, m - 1, d, 12));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }
  return parsed;
}

export function addDays(date: string, days: number): string {
  if (typeof date !== 'string' || !date.trim() || !Number.isFinite(days)) return '';
  const value = utcNoon(date);
  if (!value) return '';
  value.setUTCDate(value.getUTCDate() + Math.trunc(days));
  return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
}
