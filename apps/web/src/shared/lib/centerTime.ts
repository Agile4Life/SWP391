import { getIntlLocale } from '../i18n/language';
/**
 * Giờ hiển thị luôn theo múi giờ trung tâm (UTC+7, không có giờ mùa hè), kể cả khi trình duyệt đặt múi giờ khác.
 * Backend trả `LocalDateTime` không kèm offset (giờ trung tâm), chuỗi PostgreSQL (`+07` hoặc dấu cách) hoặc `Instant`
 * có `Z`; tất cả đều được chuẩn hóa và kiểm tra lịch thực tế (chặn ngày không tồn tại như 2026-02-31).
 */
export const CENTER_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ISO_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:$|([T ])(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:([zZ])|([+-])(\d{2})(?::?(\d{2}))?)?$)/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Đọc chuỗi ngày/giờ từ backend thành Date theo múi giờ trung tâm (+07:00 nếu chuỗi không có múi giờ);
 * hỗ trợ dấu cách (tương thích Safari), offset 2 chữ số của PostgreSQL (`+07` → `+07:00`), và từ chối ngày lịch sai.
 */
export function parseCenterTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;

  const match = ISO_DATE_TIME_RE.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;

  const hasTime = match[4] !== undefined;
  if (!hasTime) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+07:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = match[7] !== undefined ? Number(match[7]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const secStr = match[7] ?? '00';
  const fractional = match[8] ? `.${match[8].slice(0, 3).padEnd(3, '0')}` : '';

  let offset: string;
  if (match[9]) {
    offset = 'Z';
  } else if (match[10] && match[11]) {
    const offHour = Number(match[11]);
    const offMin = match[12] ? Number(match[12]) : 0;
    if (offHour > 23 || offMin > 59) return null;
    offset = `${match[10]}${match[11]}:${match[12] ?? '00'}`;
  } else {
    offset = '+07:00';
  }

  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[5]}:${match[6]}:${secStr}${fractional}${offset}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${key}`;
  let formatter = dateFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeZone: CENTER_TIME_ZONE, hourCycle: 'h23', ...options });
    dateFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * Định dạng chuỗi thời gian theo múi giờ trung tâm và ngôn ngữ hiện tại (24 giờ); không đọc được thì trả
 * fallback.
 */
function format(value: string | null | undefined, key: string, options: Intl.DateTimeFormatOptions, fallback: string): string {
  const date = parseCenterTime(value);
  return date ? getFormatter(getIntlLocale(), key, options).format(date) : fallback;
}

/**
 * Định dạng giờ:phút theo múi giờ trung tâm, ví dụ 14:05.
 *
 * 14:05
 */
export const formatCenterTime = (value: string | null | undefined, fallback = '—') =>
  format(value, 'hm', { hour: '2-digit', minute: '2-digit' }, fallback);

/**
 * Định dạng giờ:phút:giây theo múi giờ trung tâm, ví dụ 14:05:09.
 *
 * 14:05:09
 */
export const formatCenterTimeSeconds = (value: string | null | undefined, fallback = '—') =>
  format(value, 'hms', { hour: '2-digit', minute: '2-digit', second: '2-digit' }, fallback);

/**
 * Định dạng ngày/tháng/năm theo múi giờ trung tâm, ví dụ 02/11/2026.
 *
 * 02/11/2026
 */
export const formatCenterDate = (value: string | null | undefined, fallback = '—') =>
  format(value, 'dmy', { day: '2-digit', month: '2-digit', year: 'numeric' }, fallback);

/**
 * Định dạng "giờ ngày" theo múi giờ trung tâm, ví dụ 14:05 02/11/2026.
 *
 * 14:05 02/11/2026
 */
export function formatCenterDateTime(value: string | null | undefined, fallback = '—'): string {
  const time = formatCenterTime(value, '');
  return time ? `${time} ${formatCenterDate(value)}` : fallback;
}

/** Giờ trong ngày "17:30:00" → "17:30" (giờ học từ API không kèm ngày). */
export const formatClockTime = (value: string | null | undefined, fallback = '—') =>
  value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback;

/**
 * Định dạng khoảng giờ "bắt đầu–kết thúc", ví dụ 17:30–18:30; nếu cả hai mốc đều rỗng/không hợp lệ thì trả fallback ('—').
 */
export const formatTimeRange = (start: string | null | undefined, end: string | null | undefined, fallback = '—') => {
  const startLabel = formatClockTime(start, '');
  const endLabel = formatClockTime(end, '');
  if (!startLabel && !endLabel) return fallback;
  return `${startLabel || fallback}–${endLabel || fallback}`;
};

const centerPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CENTER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Ngày "YYYY-MM-DD" và giờ "HH:mm" hiện tại theo múi giờ trung tâm; so sánh được trực tiếp dưới dạng chuỗi. */
export function centerNowParts(now = new Date()): { date: string; time: string } {
  const parts = centerPartsFormatter.formatToParts(now);
  // Lấy giá trị một thành phần (năm, tháng, giờ...) trong kết quả formatToParts.
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
