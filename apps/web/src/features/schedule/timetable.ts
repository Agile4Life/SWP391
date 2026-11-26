import { SCHEDULE_SLOT_COUNT, formatSlotLabel, resolveSlotIndex } from './slots';

/** Khung giờ hiển thị của thời khóa biểu tuần: 06:00 – 22:00. */
export const TIMETABLE_START_HOUR = 6;
export const TIMETABLE_END_HOUR = 22;
export const TIMETABLE_HOURS: number[] = Array.from(
  { length: TIMETABLE_END_HOUR - TIMETABLE_START_HOUR },
  (_, index) => TIMETABLE_START_HOUR + index,
);

const RANGE_START_MIN = TIMETABLE_START_HOUR * 60;
const RANGE_END_MIN = TIMETABLE_END_HOUR * 60;

/** Tông màu của khối buổi học: còn chỗ, của tôi, đầy, đã qua, đã hủy hoặc trung tính. */
export type TimetableTone = 'open' | 'mine' | 'full' | 'past' | 'cancelled' | 'neutral';

/** Một buổi học trên lịch: id, ngày, giờ, tiêu đề, phòng, thông tin phụ, tông màu và nhãn trợ năng. */
export interface TimetableEvent {
  id: string;
  /** YYYY-MM-DD theo lịch địa phương. */
  date: string;
  /** HH:mm hoặc HH:mm:ss. */
  startTime: string;
  endTime: string;
  title: string;
  /** Phòng: cùng với `title` là phần duy nhất hiện trên khối. */
  meta?: string;
  /** Thông tin phụ (sĩ số, trạng thái, HLV…): không hiện trên khối, chỉ có trong chú giải khi rê chuột và khi bấm xem chi tiết. */
  badge?: string;
  detail?: string;
  /** Màu nhấn phân biệt bộ môn (áp dụng ở viền trái / chấm màu, tuân thủ độ tương phản Dark & Light). */
  accentColor?: string;
  /** Tên bộ môn hiển thị trong danh sách gom cụm hoặc lịch theo phòng. */
  disciplineName?: string;
  /** Mã phòng dùng để gom cột trong chế độ Tổng quan theo phòng. */
  roomId?: number;
  tone: TimetableTone;
  ariaLabel: string;
}

/** Bảng màu dịu phân biệt tối đa 8 bộ môn trên lịch (đọc rõ trên cả Dark và Light, không trùng màu lỗi/Volt). */
export const DISCIPLINE_PALETTE = [
  '#60a5fa', // sky blue
  '#34d399', // emerald
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#22d3ee', // cyan
  '#f472b6', // rose
  '#818cf8', // indigo
  '#2dd4bf', // teal
] as const;

/** Gán màu phân biệt ổn định theo mã hoặc tên bộ môn. */
export function disciplineAccentColor(key?: number | string | null): string {
  if (key === null || key === undefined || key === '') return DISCIPLINE_PALETTE[0];
  if (typeof key === 'number' && Number.isFinite(key)) {
    return DISCIPLINE_PALETTE[Math.abs(Math.trunc(key)) % DISCIPLINE_PALETTE.length];
  }
  let hash = 0;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return DISCIPLINE_PALETTE[Math.abs(hash) % DISCIPLINE_PALETTE.length];
}

/** Cụm buổi học bị ẩn bớt khi cùng một khung giờ có quá nhiều lớp chạy song song (hiển thị dạng "+N lớp"). */
export interface OverflowCluster<T extends TimetableEvent = TimetableEvent> {
  id: string;
  date: string;
  lane: number;
  lanes: number;
  topPct: number;
  heightPct: number;
  hiddenEvents: T[];
  allEvents: T[];
  rangeLabel: string;
}

/** Kết quả sau khi giới hạn số làn hiển thị tối đa trong 1 cột ngày: các khối hiển thị trực tiếp và các nút gom "+N lớp". */
export interface GroupedDayLayout<T extends TimetableEvent = TimetableEvent> {
  visible: PositionedEvent<T>[];
  overflows: OverflowCluster<T>[];
}

/**
 * Gom các cụm chồng giờ có quá nhiều làn (> maxVisible) thành tối đa (maxVisible - 1) làn hiển thị trực tiếp
 * cộng 1 làn nút gom "+N lớp". Bảo toàn 100% số sự kiện (visible + sum(hiddenEvents) === positioned.length)
 * và đảm bảo mỗi thẻ luôn có bề rộng ít nhất 100% / maxVisible để không bị bóp méo hay đè chữ.
 */
export function groupVisibleLanes<T extends TimetableEvent>(
  positioned: PositionedEvent<T>[],
  maxVisible = 2,
): GroupedDayLayout<T> {
  if (maxVisible < 2 || positioned.length === 0) {
    return { visible: positioned, overflows: [] };
  }

  // Phân nhóm các khối chồng nhau theo trục dọc (dựa trên topPct và topPct + heightPct).
  const ordered = [...positioned].sort((a, b) => a.topPct - b.topPct || a.lane - b.lane || a.event.id.localeCompare(b.event.id));
  const clusters: PositionedEvent<T>[][] = [];
  let current: PositionedEvent<T>[] = [];
  let currentEnd = -1;

  for (const item of ordered) {
    const bottom = item.topPct + item.heightPct;
    if (current.length > 0 && item.topPct >= currentEnd - 1e-4) {
      clusters.push(current);
      current = [];
      currentEnd = -1;
    }
    current.push(item);
    currentEnd = Math.max(currentEnd, bottom);
  }
  if (current.length > 0) clusters.push(current);

  const visible: PositionedEvent<T>[] = [];
  const overflows: OverflowCluster<T>[] = [];
  const directLaneLimit = maxVisible - 1;

  for (const cluster of clusters) {
    const clusterLanes = Math.max(...cluster.map((item) => item.lanes));
    if (clusterLanes <= maxVisible) {
      visible.push(...cluster);
      continue;
    }

    const shown = cluster.filter((item) => item.lane < directLaneLimit);
    const hidden = cluster.filter((item) => item.lane >= directLaneLimit);
    for (const item of shown) {
      visible.push({ ...item, lanes: maxVisible });
    }
    if (hidden.length === 0) continue;

    const topPct = Math.min(...hidden.map((item) => item.topPct));
    const bottomPct = Math.max(...hidden.map((item) => item.topPct + item.heightPct));
    const allSorted = [...cluster]
      .sort((a, b) => toMinutes(a.event.startTime) - toMinutes(b.event.startTime) || a.event.title.localeCompare(b.event.title))
      .map((item) => item.event);
    const hiddenSorted = [...hidden]
      .sort((a, b) => toMinutes(a.event.startTime) - toMinutes(b.event.startTime) || a.event.title.localeCompare(b.event.title))
      .map((item) => item.event);

    const minStart = allSorted.reduce((best, ev) => (toMinutes(ev.startTime) < toMinutes(best) ? ev.startTime : best), allSorted[0].startTime);
    const maxEnd = allSorted.reduce((best, ev) => (toMinutes(ev.endTime) > toMinutes(best) ? ev.endTime : best), allSorted[0].endTime);

    overflows.push({
      id: `overflow-${cluster[0].event.date}-${hiddenSorted[0].id}`,
      date: cluster[0].event.date,
      lane: directLaneLimit,
      lanes: maxVisible,
      topPct,
      heightPct: Math.max(bottomPct - topPct, 6.25),
      hiddenEvents: hiddenSorted,
      allEvents: allSorted,
      rangeLabel: formatSlotLabel(minStart, maxEnd),
    });
  }

  return { visible, overflows };
}

/** Buổi học đã được xếp vị trí: làn song song, số làn của cụm và vị trí/chiều cao theo phần trăm. */
export interface PositionedEvent<T extends TimetableEvent = TimetableEvent> {
  event: T;
  lane: number;
  lanes: number;
  topPct: number;
  heightPct: number;
}

// Thêm số 0 đứng trước cho số nhỏ hơn 10.
const pad = (value: number) => String(value).padStart(2, '0');

/** YYYY-MM-DD -> Date lúc 12:00 địa phương (tránh lệch ngày do múi giờ khi cộng/trừ ngày). */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Chuyển Date thành chuỗi YYYY-MM-DD theo lịch địa phương. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Cộng/trừ số ngày vào một ngày YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Thứ Hai của tuần chứa ngày `iso` (tuần Thứ 2 – Chủ nhật). */
export function mondayOf(iso: string): string {
  const date = parseISODate(iso);
  return addDays(iso, -((date.getDay() + 6) % 7));
}

/** Bảy ngày của tuần bắt đầu từ thứ Hai. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Ngày hôm nay dạng YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Đổi chuỗi giờ HH:mm thành số phút trong ngày. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/** Cắt chuỗi giờ về dạng HH:mm. */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Nhãn giờ tròn dạng HH:00. */
export function hourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Tên thứ trong tuần (Chủ nhật, Thứ 2...) của một ngày. */
export function weekdayLabel(iso: string): string {
  return WEEKDAY_LABELS[parseISODate(iso).getDay()];
}

/**
 * Định dạng ngày dd/MM.
 *
 * dd/MM
 */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

/** Nhãn khoảng tuần dạng "dd/MM – dd/MM/yyyy". */
export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${shortDate(weekStart)} – ${shortDate(end)}/${end.slice(0, 4)}`;
}

/** Buổi học có nằm (một phần) trong khung 06:00–22:00 không. */
export function isWithinRange(event: Pick<TimetableEvent, 'startTime' | 'endTime'>): boolean {
  return toMinutes(event.endTime) > RANGE_START_MIN && toMinutes(event.startTime) < RANGE_END_MIN;
}

/** Buổi học có chạm vào ô giờ [hour, hour+1) không. */
export function overlapsHour(event: Pick<TimetableEvent, 'startTime' | 'endTime'>, hour: number): boolean {
  return toMinutes(event.startTime) < (hour + 1) * 60 && toMinutes(event.endTime) > hour * 60;
}

/**
 * Xếp các buổi học trong cùng một ngày vào làn song song: buổi chồng giờ đứng cạnh nhau,
 * mỗi cụm chồng giờ chia đều chiều rộng cột.
 */
export function layoutDayEvents<T extends TimetableEvent>(
  events: T[],
  startHour: number = TIMETABLE_START_HOUR,
  endHour: number = TIMETABLE_END_HOUR,
): PositionedEvent<T>[] {
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  const rangeMinutes = rangeEnd - rangeStart;
  const sorted = events
    .filter((event) => toMinutes(event.endTime) > rangeStart && toMinutes(event.startTime) < rangeEnd)
    .map((event) => ({
      event,
      start: Math.max(toMinutes(event.startTime), rangeStart),
      end: Math.min(toMinutes(event.endTime), rangeEnd),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.event.id.localeCompare(b.event.id));

  const result: PositionedEvent<T>[] = [];
  let cluster: { event: T; start: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  // Chốt cụm buổi chồng giờ: gán số làn và vị trí cho từng buổi trong cụm.
  const flush = () => {
    const lanes = laneEnds.length;
    for (const item of cluster) {
      result.push({
        event: item.event,
        lane: item.lane,
        lanes,
        topPct: ((item.start - rangeStart) / rangeMinutes) * 100,
        heightPct: (Math.max(item.end - item.start, 15) / rangeMinutes) * 100,
      });
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ ...item, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return result;
}

/**
 * Xếp các buổi học trong cùng một ngày vào đúng hàng Slot cố định (Slot 1 – Slot 5).
 * Các buổi trùng cùng một Slot đứng song song theo làn để `groupVisibleLanes` gom "+N lớp" khi có >= 3 lớp.
 */
export function layoutDaySlotEvents<T extends TimetableEvent>(events: T[]): PositionedEvent<T>[] {
  const bySlot = new Map<number, T[]>();
  for (const event of events) {
    const slotIndex = resolveSlotIndex(event.startTime, event.endTime);
    if (slotIndex < 0) continue;
    const list = bySlot.get(slotIndex) ?? [];
    list.push(event);
    bySlot.set(slotIndex, list);
  }

  const rowHeightPct = 100 / SCHEDULE_SLOT_COUNT;
  const result: PositionedEvent<T>[] = [];
  for (let slotIndex = 0; slotIndex < SCHEDULE_SLOT_COUNT; slotIndex += 1) {
    const slotEvents = bySlot.get(slotIndex);
    if (!slotEvents || slotEvents.length === 0) continue;
    const sorted = [...slotEvents].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.id.localeCompare(b.id),
    );
    const lanes = sorted.length;
    const topPct = slotIndex * rowHeightPct;
    for (let lane = 0; lane < lanes; lane += 1) {
      result.push({
        event: sorted[lane],
        lane,
        lanes,
        topPct,
        heightPct: rowHeightPct,
      });
    }
  }
  return result;
}

/** Giờ bắt đầu/kết thúc làm tròn ra giờ chẵn bao trọn buổi: 11:00–14:30 -> 11–15. Luôn dài ít nhất 1 giờ. */
export function roundedHourSpan(event: Pick<TimetableEvent, 'startTime' | 'endTime'>): { start: number; end: number } {
  const start = Math.floor(toMinutes(event.startTime) / 60);
  const end = Math.max(start + 1, Math.ceil(toMinutes(event.endTime) / 60));
  return { start, end };
}

/** Khoảng giờ chẵn của buổi, ví dụ "11:00–15:00". */
export function roundedRangeLabel(event: Pick<TimetableEvent, 'startTime' | 'endTime'>): string {
  const { start, end } = roundedHourSpan(event);
  return `${hourLabel(start)}–${hourLabel(end)}`;
}

/** Một ô 1 giờ của một buổi học. */
export interface HourlyTimetableEvent extends TimetableEvent {
  /** id của buổi gốc (id của ô có thêm hậu tố giờ). */
  sourceId: string;
  hour: number;
  /** Thứ tự ô trong buổi (bắt đầu từ 1) và tổng số ô. */
  part: number;
  parts: number;
}

/**
 * Tách mỗi buổi thành từng ô 1 giờ theo giờ chẵn: buổi 11:00–14:30 thành 4 ô 11, 12, 13, 14.
 * Bảng tuần vẽ mỗi giờ một ô thay vì gộp thành một khối cao.
 */
export function splitIntoHours(events: TimetableEvent[]): HourlyTimetableEvent[] {
  return events.flatMap((event) => {
    const { start, end } = roundedHourSpan(event);
    return Array.from({ length: end - start }, (_, index) => {
      const hour = start + index;
      return {
        ...event,
        id: `${event.id}@${hour}`,
        sourceId: event.id,
        startTime: hourLabel(hour),
        endTime: hourLabel(hour + 1),
        hour,
        part: index + 1,
        parts: end - start,
      };
    });
  });
}

/** Lớp CSS theo chiều cao thật của khối lịch: thấp thì bỏ phòng, khoảng 1 giờ thì tên một dòng. */
export function blockClass(heightPx: number): string {
  return heightPx < 64 ? ' is-short' : heightPx < 100 ? ' is-compact' : '';
}

/** Số giờ tối thiểu của khung thu gọn, để tuần ít lịch không thành bảng quá thấp. */
export const TIMETABLE_MIN_FIT_HOURS = 8;

/**
 * Khung giờ thu gọn theo lịch thật của tuần: từ giờ của buổi sớm nhất tới giờ kết thúc của buổi muộn nhất,
 * nằm trong 06:00–22:00 và dài ít nhất `minHours` giờ. Tuần không có buổi nào thì trả về đủ 06:00–22:00.
 */
export function fitHourRange(
  events: Pick<TimetableEvent, 'startTime' | 'endTime'>[],
  minHours: number = TIMETABLE_MIN_FIT_HOURS,
): number[] {
  const inRange = events.filter(isWithinRange);
  if (inRange.length === 0) return TIMETABLE_HOURS;
  let start = Math.max(TIMETABLE_START_HOUR, Math.floor(Math.min(...inRange.map((event) => toMinutes(event.startTime))) / 60));
  let end = Math.min(TIMETABLE_END_HOUR, Math.ceil(Math.max(...inRange.map((event) => toMinutes(event.endTime))) / 60));
  const span = Math.min(minHours, TIMETABLE_END_HOUR - TIMETABLE_START_HOUR);
  while (end - start < span) {
    if (end < TIMETABLE_END_HOUR) end += 1;
    if (end - start < span && start > TIMETABLE_START_HOUR) start -= 1;
  }
  return Array.from({ length: end - start }, (_, index) => start + index);
}
