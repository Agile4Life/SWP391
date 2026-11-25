import { centerNowParts } from '../../shared/lib/centerTime';
import { SCHEDULE_SLOT_COUNT, formatSlotLabel, resolveSlotIndex } from './slots';

/** Tông màu của khối buổi học: còn chỗ, của tôi, đầy, đã qua, đã hủy hoặc trung tính. */
export type TimetableTone = 'open' | 'mine' | 'full' | 'past' | 'cancelled' | 'neutral';

/** Một buổi học trên lịch: id, ngày, giờ, tiêu đề, phòng, thông tin phụ, tông màu và nhãn trợ năng. */
export interface TimetableEvent {
  id: string;
  /** YYYY-MM-DD theo múi giờ trung tâm (Asia/Ho_Chi_Minh). */
  date: string;
  /** HH:mm hoặc HH:mm:ss. */
  startTime: string;
  endTime: string;
  title: string;
  /** Tên phòng hiển thị dưới tiêu đề khối. */
  meta?: string;
  /** Thông tin phụ (sĩ số, trạng thái): hiển thị dạng badge khi lớp đầy, trong tooltip và modal chi tiết. */
  badge?: string;
  /** Thông tin dòng phụ dưới phòng (ví dụ tên HLV hoặc học viên). */
  detail?: string;
  /** Màu nhấn phân biệt bộ môn (viền mảnh 4 cạnh / chấm màu, tuân thủ độ tương phản Dark & Light). */
  accentColor?: string;
  /** Tên bộ môn hiển thị trong danh sách gom cụm. */
  disciplineName?: string;
  /** Mã phòng liên kết với buổi học. */
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
  const minSlotHeightPct = 100 / SCHEDULE_SLOT_COUNT;

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
      heightPct: Math.max(bottomPct - topPct, minSlotHeightPct),
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

/** YYYY-MM-DD -> Date lúc 12:00 địa phương (giữ tương thích cho các màn hình đọc getDay/getDate/getMonth). */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Chuyển Date thành chuỗi YYYY-MM-DD theo múi giờ trung tâm (Asia/Ho_Chi_Minh). */
export function toISODate(date: Date): string {
  return centerNowParts(date).date;
}

/** Cộng/trừ số ngày vào một ngày YYYY-MM-DD (không phụ thuộc múi giờ máy cục bộ hay DST). */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** Thứ Hai của tuần chứa ngày `iso` (tuần Thứ 2 – Chủ nhật). */
export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return addDays(iso, -((utc.getUTCDay() + 6) % 7));
}

/** Bảy ngày của tuần bắt đầu từ thứ Hai. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Ngày hôm nay dạng YYYY-MM-DD theo múi giờ trung tâm (Asia/Ho_Chi_Minh). */
export function todayISO(now: Date = new Date()): string {
  return centerNowParts(now).date;
}

/** Đổi chuỗi giờ HH:mm thành số phút trong ngày. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Tên thứ trong tuần (Chủ nhật, Thứ 2...) của một ngày. */
export function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_LABELS[utc.getUTCDay()];
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

/** Lớp CSS theo chiều cao thật của khối lịch: thấp thì bỏ phòng, trung bình thì tên một dòng. */
export function blockClass(heightPx: number): string {
  return heightPx < 64 ? ' is-short' : heightPx < 100 ? ' is-compact' : '';
}
