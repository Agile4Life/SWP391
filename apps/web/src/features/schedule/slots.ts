/**
 * Nguồn chuẩn duy nhất cho hệ thống 5 Slot lịch cố định (07:00 – 19:30) toàn Portal.
 * Dùng chung cho Lớp học nhóm (Manager, Coach, Member) và đặt lịch PT 1:1.
 */
export type ScheduleSlotCode = 'SLOT_1' | 'SLOT_2' | 'SLOT_3' | 'SLOT_4' | 'SLOT_5';

export interface ScheduleSlot {
  readonly number: 1 | 2 | 3 | 4 | 5;
  readonly code: ScheduleSlotCode;
  readonly label: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly startApi: string;
  readonly endApi: string;
  readonly rangeLabel: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export const SCHEDULE_SLOTS: readonly ScheduleSlot[] = [
  {
    number: 1,
    code: 'SLOT_1',
    label: 'Slot 1',
    startTime: '07:00',
    endTime: '09:30',
    startApi: '07:00:00',
    endApi: '09:30:00',
    rangeLabel: '07:00 – 09:30',
    startMinutes: 7 * 60,
    endMinutes: 9 * 60 + 30,
  },
  {
    number: 2,
    code: 'SLOT_2',
    label: 'Slot 2',
    startTime: '09:45',
    endTime: '11:15',
    startApi: '09:45:00',
    endApi: '11:15:00',
    rangeLabel: '09:45 – 11:15',
    startMinutes: 9 * 60 + 45,
    endMinutes: 11 * 60 + 15,
  },
  {
    number: 3,
    code: 'SLOT_3',
    label: 'Slot 3',
    startTime: '11:30',
    endTime: '14:00',
    startApi: '11:30:00',
    endApi: '14:00:00',
    rangeLabel: '11:30 – 14:00',
    startMinutes: 11 * 60 + 30,
    endMinutes: 14 * 60,
  },
  {
    number: 4,
    code: 'SLOT_4',
    label: 'Slot 4',
    startTime: '14:15',
    endTime: '16:45',
    startApi: '14:15:00',
    endApi: '16:45:00',
    rangeLabel: '14:15 – 16:45',
    startMinutes: 14 * 60 + 15,
    endMinutes: 16 * 60 + 45,
  },
  {
    number: 5,
    code: 'SLOT_5',
    label: 'Slot 5',
    startTime: '17:00',
    endTime: '19:30',
    startApi: '17:00:00',
    endApi: '19:30:00',
    rangeLabel: '17:00 – 19:30',
    startMinutes: 17 * 60,
    endMinutes: 19 * 60 + 30,
  },
] as const;

export const SCHEDULE_SLOT_COUNT = SCHEDULE_SLOTS.length;
export const SCHEDULE_DAY_START_MINUTES = SCHEDULE_SLOTS[0].startMinutes;
export const SCHEDULE_DAY_END_MINUTES = SCHEDULE_SLOTS[SCHEDULE_SLOTS.length - 1].endMinutes;

/** Chuẩn hóa chuỗi giờ bất kỳ (`7:00`, `07:00:00`, `07:00`) về `HH:mm`. */
export function normalizeSlotTime(time?: string | null): string {
  if (!time) return '';
  const trimmed = time.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Đổi chuỗi giờ `HH:mm` / `HH:mm:ss` thành số phút trong ngày; trả `null` nếu không hợp lệ. */
export function parseSlotMinutes(time?: string | null): number | null {
  const normalized = normalizeSlotTime(time);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Tìm Slot theo số thứ tự `1..5`. */
export function findSlotByNumber(slotNumber?: number | null): ScheduleSlot | undefined {
  if (typeof slotNumber !== 'number' || !Number.isInteger(slotNumber)) return undefined;
  return SCHEDULE_SLOTS.find((slot) => slot.number === slotNumber);
}

/** So khớp chặt cả giờ bắt đầu và giờ kết thúc với 1 trong 5 Slot cố định. */
export function findExactScheduleSlot(
  startTime?: string | null,
  endTime?: string | null,
): ScheduleSlot | undefined {
  const start = normalizeSlotTime(startTime);
  const end = normalizeSlotTime(endTime);
  if (!start || !end) return undefined;
  return SCHEDULE_SLOTS.find((slot) => slot.startTime === start && slot.endTime === end);
}

/**
 * Tìm Slot chuẩn theo `startTime` và (tùy chọn) `endTime`.
 * Nếu truyền cả hai thì so khớp chính xác cả hai; nếu bỏ qua `endTime` thì so khớp theo `startTime`.
 */
export function findScheduleSlot(
  startTime?: string | null,
  endTime?: string | null,
): ScheduleSlot | undefined {
  const start = normalizeSlotTime(startTime);
  if (!start) return undefined;
  const end = normalizeSlotTime(endTime);
  if (end) {
    return SCHEDULE_SLOTS.find((slot) => slot.startTime === start && slot.endTime === end);
  }
  return SCHEDULE_SLOTS.find((slot) => slot.startTime === start);
}

/**
 * Quy đổi khoảng giờ về chỉ số hàng `0..4` của lưới 5 Slot:
 * 1. Ưu tiên khớp chính xác Slot (`07:00–09:30` → `0`, ..., `17:00–19:30` → `4`).
 * 2. Nếu là giờ tùy chỉnh nằm trong `07:00–19:30`, chọn Slot giao nhau nhiều nhất (`start < slot.end && end > slot.start`).
 * 3. Trả về `-1` nếu nằm ngoài `07:00–19:30` hoặc không giao với Slot nào.
 */
export function resolveSlotIndex(startTime?: string | null, endTime?: string | null): number {
  const exact = endTime ? findExactScheduleSlot(startTime, endTime) : findScheduleSlot(startTime);
  if (exact) return exact.number - 1;

  const startMin = parseSlotMinutes(startTime);
  if (startMin === null) return -1;
  const parsedEnd = parseSlotMinutes(endTime);
  const endMin = parsedEnd !== null && parsedEnd > startMin ? parsedEnd : startMin + 1;

  if (endMin <= SCHEDULE_DAY_START_MINUTES || startMin >= SCHEDULE_DAY_END_MINUTES) {
    return -1;
  }

  let bestIndex = -1;
  let bestOverlap = 0;
  for (let index = 0; index < SCHEDULE_SLOTS.length; index += 1) {
    const slot = SCHEDULE_SLOTS[index];
    const overlap = Math.min(endMin, slot.endMinutes) - Math.max(startMin, slot.startMinutes);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/** Sự kiện có khớp/giao vào 1 trong 5 Slot (`07:00–19:30`) hay không. */
export function isWithinScheduleSlots(startTime?: string | null, endTime?: string | null): boolean {
  return resolveSlotIndex(startTime, endTime) !== -1;
}

/** Định dạng đầy đủ: `"Slot 1 · 07:00 – 09:30"` (hoặc `"HH:mm – HH:mm"` nếu không thuộc 5 Slot). */
export function formatSlotLabel(
  startTime?: string | null,
  endTime?: string | null,
  slotNumber?: number | null,
): string {
  const slot = findSlotByNumber(slotNumber) ?? findScheduleSlot(startTime, endTime);
  if (slot) return `${slot.label} · ${slot.rangeLabel}`;
  const start = normalizeSlotTime(startTime);
  const end = normalizeSlotTime(endTime);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

/** Định dạng gọn: `"Slot 1 (07:00–09:30)"` (hoặc `"HH:mm–HH:mm"` nếu không thuộc 5 Slot). */
export function formatSlotShort(
  startTime?: string | null,
  endTime?: string | null,
  slotNumber?: number | null,
): string {
  const slot = findSlotByNumber(slotNumber) ?? findScheduleSlot(startTime, endTime);
  if (slot) return `${slot.label} (${slot.startTime}–${slot.endTime})`;
  const start = normalizeSlotTime(startTime);
  const end = normalizeSlotTime(endTime);
  if (start && end) return `${start}–${end}`;
  return start || end || '';
}

/** Slot đã kết thúc so với ngày và phút hiện tại hay chưa. */
export function isSlotPast(
  date: string,
  slot: ScheduleSlot,
  today: string,
  nowMinutes: number,
): boolean {
  return date < today || (date === today && slot.endMinutes <= nowMinutes);
}

/**
 * Vị trí phần trăm (`0..100`) của vạch thời gian hiện tại trên lưới 5 hàng Slot.
 * Trả về `null` khi ngoài khung `07:00 – 19:30`.
 */
export function nowSlotPercent(nowMinutes: number): number | null {
  if (nowMinutes < SCHEDULE_DAY_START_MINUTES || nowMinutes >= SCHEDULE_DAY_END_MINUTES) {
    return null;
  }
  const rowStep = 100 / SCHEDULE_SLOT_COUNT;
  for (let index = 0; index < SCHEDULE_SLOTS.length; index += 1) {
    const slot = SCHEDULE_SLOTS[index];
    if (nowMinutes >= slot.startMinutes && nowMinutes < slot.endMinutes) {
      const progress = (nowMinutes - slot.startMinutes) / (slot.endMinutes - slot.startMinutes);
      return (index + progress) * rowStep;
    }
    const nextSlot = SCHEDULE_SLOTS[index + 1];
    if (nextSlot && nowMinutes >= slot.endMinutes && nowMinutes < nextSlot.startMinutes) {
      return (index + 1) * rowStep;
    }
  }
  return null;
}
