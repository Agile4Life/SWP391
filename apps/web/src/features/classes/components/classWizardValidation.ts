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
