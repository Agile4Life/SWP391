import type { Room } from '../../manager/catalogApi';
import type { ScheduleSlot } from '../../schedule/slots';
import type {
  CoachAvailabilityDto,
  CoachUser,
  RecurringAvailabilityDto,
  RoomAvailabilityDto,
} from '../classesApi';

export type WizardTranslator = (vi: string, en?: string) => string;

export const CLASS_NAME_MAX_LENGTH = 150;

export const WIZARD_WEEKDAYS: readonly {
  code: string;
  vi: string;
  en: string;
  shortVi: string;
  shortEn: string;
}[] = [
  { code: 'MONDAY', vi: 'Thứ 2', en: 'Mon', shortVi: 'T2', shortEn: 'Mon' },
  { code: 'TUESDAY', vi: 'Thứ 3', en: 'Tue', shortVi: 'T3', shortEn: 'Tue' },
  { code: 'WEDNESDAY', vi: 'Thứ 4', en: 'Wed', shortVi: 'T4', shortEn: 'Wed' },
  { code: 'THURSDAY', vi: 'Thứ 5', en: 'Thu', shortVi: 'T5', shortEn: 'Thu' },
  { code: 'FRIDAY', vi: 'Thứ 6', en: 'Fri', shortVi: 'T6', shortEn: 'Fri' },
  { code: 'SATURDAY', vi: 'Thứ 7', en: 'Sat', shortVi: 'T7', shortEn: 'Sat' },
  { code: 'SUNDAY', vi: 'Chủ nhật', en: 'Sun', shortVi: 'CN', shortEn: 'Sun' },
] as const;

/** Số buổi tối đa của một khóa: giữ khoảng ngày trong giới hạn 365 ngày của backend kể cả khi học 1 buổi/tuần. */
export const COURSE_SESSION_COUNT_MAX = 52;

const JS_DAY_CODES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Mã thứ (MONDAY…SUNDAY) của một ngày YYYY-MM-DD. */
export function weekdayCodeOf(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return JS_DAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? 'MONDAY';
}

/**
 * Ngày kết thúc khóa = ngày học thứ N tính từ ngày khai giảng theo các thứ đã chọn
 * (ví dụ 12 buổi, 3 buổi/tuần → buổi thứ 12 rơi vào tuần thứ 4). Trả '' nếu đầu vào không hợp lệ.
 */
export function computeCourseEndDate(startDate: string, days: readonly string[], sessionCount: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || days.length === 0
    || !Number.isInteger(sessionCount) || sessionCount < 1) return '';
  const picked = new Set(days);
  const [y, m, d] = startDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  let remaining = sessionCount;
  // Mỗi tuần có ít nhất 1 ngày học nên vòng lặp kết thúc sau tối đa 7 * sessionCount ngày.
  for (let guard = 0; guard < 7 * sessionCount + 7; guard += 1) {
    if (picked.has(JS_DAY_CODES[cursor.getUTCDay()]) && --remaining === 0) {
      return cursor.toISOString().slice(0, 10);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return '';
}

/**
 * Cập nhật các thứ học khi đổi ngày khai giảng: thứ mới luôn được chọn; thứ khai giảng cũ chỉ bị gỡ nếu trước đó
 * được thêm tự động (người dùng chưa tự chọn). Trả về các thứ mới và thứ đang được thêm tự động.
 */
export function daysForStartDate(
  days: readonly string[],
  autoAddedDay: string | null,
  startDayCode: string,
): { days: string[]; autoAddedDay: string | null } {
  const kept = days.filter((day) => day !== autoAddedDay || day === startDayCode);
  if (startDayCode && !kept.includes(startDayCode)) {
    return { days: [...kept, startDayCode], autoAddedDay: startDayCode };
  }
  return { days: kept, autoAddedDay: startDayCode && startDayCode === autoAddedDay ? autoAddedDay : null };
}

/** Kiểm tra số buổi của khóa: số nguyên từ 1 đến COURSE_SESSION_COUNT_MAX. */
export function validateCourseSessionCount(raw: string, t: WizardTranslator): string | null {
  const value = Number(raw);
  if (!raw.trim() || !Number.isInteger(value) || value < 1 || value > COURSE_SESSION_COUNT_MAX) {
    return t(
      `Số buổi của khóa phải là số nguyên từ 1 đến ${COURSE_SESSION_COUNT_MAX}.`,
      `Course sessions must be a whole number from 1 to ${COURSE_SESSION_COUNT_MAX}.`,
    );
  }
  return null;
}

/** Sắp xếp các thứ đã chọn theo chuẩn Thứ 2 → Chủ nhật. */
export function sortRecurringDays(days: readonly string[]): string[] {
  const picked = new Set(days);
  return WIZARD_WEEKDAYS.filter((day) => picked.has(day.code)).map((day) => day.code);
}

/** Hiển thị danh sách thứ ngắn gọn (ví dụ: "T2, T4" / "Mon, Wed"). */
export function formatRecurringDaysShort(days: readonly string[], t: WizardTranslator): string {
  const picked = new Set(days);
  return WIZARD_WEEKDAYS
    .filter((day) => picked.has(day.code))
    .map((day) => t(day.shortVi, day.shortEn))
    .join(', ');
}

/** Hiển thị danh sách thứ đầy đủ (ví dụ: "Thứ 2, Thứ 4" / "Mon, Wed"). */
export function formatRecurringDaysFull(days: readonly string[], t: WizardTranslator): string {
  const picked = new Set(days);
  return WIZARD_WEEKDAYS
    .filter((day) => picked.has(day.code))
    .map((day) => t(day.vi, day.en))
    .join(', ');
}

/** Kiểm tra ràng buộc Bước 1: tên khóa học, bộ môn và học phí ngoài gói. */
export function validateWizardStep1(
  input: { name: string; disciplineId: string; price: string },
  t: WizardTranslator,
): string | null {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return t('Vui lòng nhập tên khóa học.', 'Please enter a course name.');
  }
  if (trimmedName.length > CLASS_NAME_MAX_LENGTH) {
    return t(
      'Tên khóa học tối đa 150 ký tự.',
      'Course name must be at most 150 characters.',
    );
  }
  if (!input.disciplineId) {
    return t('Vui lòng chọn bộ môn.', 'Please select a discipline.');
  }
  const priceText = input.price.trim();
  const parsedPrice = Number(priceText);
  if (priceText === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return t(
      'Học phí ngoài gói phải là số lớn hơn hoặc bằng 0.',
      'Extra fee must be a number greater than or equal to 0.',
    );
  }
  return null;
}

/** Kiểm tra ràng buộc cục bộ Bước 2 (ngày khai giảng, ngày kết thúc, các thứ học). */
export function validateWizardStep2Local(
  input: { startDate: string; endDate: string; recurringDays: readonly string[] },
  t: WizardTranslator,
): string | null {
  if (!input.startDate || !input.endDate) {
    return t(
      'Vui lòng chọn đầy đủ ngày khai giảng và ngày kết thúc.',
      'Please select both start date and end date.',
    );
  }
  if (input.endDate < input.startDate) {
    return t(
      'Ngày kết thúc phải sau hoặc bằng ngày khai giảng.',
      'End date must be on or after start date.',
    );
  }
  if (input.recurringDays.length === 0) {
    return t(
      'Vui lòng chọn ít nhất một thứ học trong tuần.',
      'Please select at least one weekday.',
    );
  }
  return null;
}

/** Kiểm tra đầy đủ điều kiện để đi tiếp từ Bước 2 sang Bước 3 dựa trên kết quả availability từ server. */
export function validateWizardStep2Advance(
  input: {
    startDate: string;
    endDate: string;
    recurringDays: readonly string[];
    checkingAvailability: boolean;
    availabilityError: string | null;
    availability: RecurringAvailabilityDto | null;
    selectedSlot: ScheduleSlot;
  },
  t: WizardTranslator,
): string | null {
  const localError = validateWizardStep2Local(input, t);
  if (localError) return localError;
  if (input.checkingAvailability) {
    return t(
      'Đang kiểm tra lịch trống, vui lòng chờ giây lát.',
      'Checking schedule availability, please wait a moment.',
    );
  }
  if (input.availabilityError) {
    return input.availabilityError;
  }
  if (!input.availability) {
    return t(
      'Chưa kiểm tra được lịch trống. Vui lòng thử kiểm tra lại.',
      'Could not verify schedule availability. Please retry the check.',
    );
  }
  if (!input.availability.validSchedule || input.availability.sessionCount <= 0) {
    return (
      input.availability.scheduleErrorMessage ||
      t(
        'Khoảng ngày và các thứ đã chọn không tạo ra buổi học hợp lệ.',
        'The selected date range and weekdays do not generate any valid sessions.',
      )
    );
  }
  if (!input.availability.selectedSlotAvailable) {
    const slotInfo = input.availability.slots.find(
      (s) => s.code === input.selectedSlot.code || s.slotNumber === input.selectedSlot.number,
    );
    return (
      input.availability.selectedSlotConflictReason ||
      slotInfo?.conflictReason ||
      t(
        'Khung giờ đã chọn hiện không khả dụng. Vui lòng chọn slot hoặc lịch khác.',
        'The selected time slot is unavailable. Please choose another slot or schedule.',
      )
    );
  }
  return null;
}

/** Kiểm tra sĩ số tối đa phải là số nguyên dương và không vượt sức chứa phòng tập. */
export function validateClassCapacity(
  capacityRaw: string,
  room: { name: string; capacity: number } | null | undefined,
  t: WizardTranslator,
): string | null {
  const trimmed = capacityRaw.trim();
  const parsed = Number(trimmed);
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 1) {
    return t(
      'Sĩ số tối đa phải là số nguyên lớn hơn hoặc bằng 1.',
      'Max capacity must be a whole number of at least 1.',
    );
  }
  if (room && parsed > room.capacity) {
    return t(
      `Sĩ số tối đa (${parsed}) vượt quá sức chứa phòng ${room.name} (${room.capacity} chỗ).`,
      `Max capacity (${parsed}) exceeds ${room.name} capacity (${room.capacity} seats).`,
    );
  }
  return null;
}

/** Chuẩn hóa danh sách phòng cho Bước 3 (ưu tiên tuyệt đối kết quả kiểm tra khả dụng từ server, kể cả khi rỗng). */
export function resolveWizardRooms(
  availability: RecurringAvailabilityDto | null,
  fallbackRooms: readonly Room[],
): RoomAvailabilityDto[] {
  if (availability !== null && availability.validSchedule) {
    return availability.rooms;
  }
  return fallbackRooms.map((room) => ({
    id: room.id,
    name: room.name,
    location: room.location,
    capacity: room.capacity,
    tier: room.tier ?? null,
    available: true,
    conflictCode: null,
    conflictReason: null,
  }));
}

/** Chuẩn hóa danh sách HLV cho Bước 3 (ưu tiên tuyệt đối kết quả kiểm tra khả dụng từ server, kể cả khi rỗng). */
export function resolveWizardCoaches(
  availability: RecurringAvailabilityDto | null,
  fallbackCoaches: readonly CoachUser[],
): CoachAvailabilityDto[] {
  if (availability !== null && availability.validSchedule) {
    return availability.coaches;
  }
  return fallbackCoaches.map((coach) => ({
    id: coach.id,
    fullName: coach.fullName,
    email: coach.email,
    available: true,
    conflictCode: null,
    conflictReason: null,
  }));
}

/** Tự chọn phòng và đồng bộ sĩ số phù hợp khi chuyển sang Bước 3. */
export function pickDefaultRoomAndCapacity(input: {
  rooms: readonly RoomAvailabilityDto[];
  prefillRoomId?: number;
  currentRoomId: string;
  currentCapacity: string;
}): { roomId: string; capacity: string } {
  const prefillMatch =
    input.prefillRoomId !== undefined
      ? input.rooms.find((r) => r.id === input.prefillRoomId && r.available)
      : undefined;
  const currentMatch = input.rooms.find(
    (r) => String(r.id) === input.currentRoomId && r.available,
  );
  const firstAvailable = input.rooms.find((r) => r.available);

  const chosen =
    (!input.currentRoomId || input.currentRoomId === String(input.prefillRoomId)) && prefillMatch
      ? prefillMatch
      : currentMatch ?? prefillMatch ?? firstAvailable;

  if (!chosen) {
    return { roomId: '', capacity: input.currentCapacity };
  }

  const parsedCap = Number(input.currentCapacity.trim());
  const nextCapacity =
    !input.currentCapacity.trim() ||
    !Number.isInteger(parsedCap) ||
    parsedCap < 1 ||
    parsedCap > chosen.capacity
      ? String(chosen.capacity)
      : input.currentCapacity;

  return {
    roomId: String(chosen.id),
    capacity: nextCapacity,
  };
}

/** Tự chọn HLV khả dụng khi chuyển sang Bước 3. */
export function pickDefaultCoachId(input: {
  coaches: readonly CoachAvailabilityDto[];
  currentCoachId: string;
}): string {
  const currentMatch = input.coaches.find(
    (c) => String(c.id) === input.currentCoachId && c.available,
  );
  if (currentMatch) return String(currentMatch.id);
  const firstAvailable = input.coaches.find((c) => c.available);
  return firstAvailable ? String(firstAvailable.id) : '';
}

/** Kiểm tra ràng buộc Bước 3 trước khi sang Bước 4 xác nhận. */
export function validateWizardStep3(
  input: {
    selectedRoom: RoomAvailabilityDto | undefined;
    selectedCoach: CoachAvailabilityDto | undefined;
    capacity: string;
  },
  t: WizardTranslator,
): string | null {
  if (!input.selectedRoom || !input.selectedRoom.available) {
    return t(
      'Vui lòng chọn một phòng tập còn trống cho khung giờ này.',
      'Please select an available room for this time slot.',
    );
  }
  const capacityError = validateClassCapacity(input.capacity, input.selectedRoom, t);
  if (capacityError) return capacityError;
  if (!input.selectedCoach || !input.selectedCoach.available) {
    return t(
      'Vui lòng chọn một huấn luyện viên sẵn sàng cho lịch học này.',
      'Please select an available coach for this schedule.',
    );
  }
  return null;
}
