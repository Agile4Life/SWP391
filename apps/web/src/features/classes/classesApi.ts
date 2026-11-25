import { apiFetch } from '../../shared/api/client';
import type { Discipline, Room } from '../manager/catalogApi';

/** Thông tin một buổi học từ API `/api/v1/classes/sessions`. */
export interface ClassSessionDto {
  id: number;
  classId: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  cancelReason?: string | null;
  className?: string;
  disciplineId?: number;
  disciplineName?: string;
  coachId?: number;
  coachName?: string;
  roomId?: number;
  roomName?: string;
  capacity?: number;
  bookedCount?: number;
}

/** Thông tin một khóa học/lớp học nhóm từ API `/api/v1/classes`. */
export interface ClassItem {
  id: number;
  name: string;
  disciplineId: number;
  disciplineName?: string;
  coachId: number;
  coachName?: string;
  roomId: number;
  roomName?: string;
  capacity: number;
  level?: string;
  description?: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE' | 'active' | 'archived' | 'inactive' | 'cancelled';
  schedule?: string;
  activeSessions?: number;
  price?: number;
  startDate?: string;
  endDate?: string;
  recurringDays?: string;
  startTime?: string;
  endTime?: string;
}

/** Học viên đã ghi danh trong một lớp hoặc buổi học. */
export interface ClassEnrolledStudent {
  id: number;
  memberId: number;
  membershipCode?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  fitnessGoal?: string | null;
  healthNotes?: string | null;
  fitnessLevel?: string | null;
  enrolledAt?: string | null;
  status: string;
}

/** Payload tạo khóa học định kỳ. */
export interface CreateRecurringClassPayload {
  name: string;
  disciplineId: number;
  coachId: number;
  roomId: number;
  capacity: number;
  level?: string;
  description?: string;
  price?: number;
  startDate: string;
  endDate: string;
  recurringDays: string[];
  startTime: string;
  endTime: string;
}

/** Payload kiểm tra khung giờ 5 Slot, phòng tập và HLV trống cho khóa học định kỳ. */
export interface RecurringAvailabilityPayload {
  disciplineId: number;
  startDate: string;
  endDate: string;
  recurringDays: string[];
  startTime: string;
  endTime: string;
}

/** Trạng thái khả dụng của một trong 5 Slot cố định. */
export interface SlotAvailabilityDto {
  slotNumber: number;
  code: string;
  startTime: string;
  endTime: string;
  available: boolean;
  disciplineConflict: boolean;
  conflictCode?: string | null;
  conflictReason?: string | null;
  availableRoomCount: number;
  availableCoachCount: number;
}

/** Trạng thái khả dụng của một phòng tập cho lịch định kỳ đang chọn. */
export interface RoomAvailabilityDto {
  id: number;
  name: string;
  location?: string | null;
  capacity: number;
  tier?: string | null;
  available: boolean;
  conflictCode?: string | null;
  conflictReason?: string | null;
}

/** Trạng thái khả dụng của một huấn luyện viên cho lịch định kỳ đang chọn. */
export interface CoachAvailabilityDto {
  id: number;
  fullName: string;
  email: string;
  available: boolean;
  conflictCode?: string | null;
  conflictReason?: string | null;
}

/** Kết quả kiểm tra khả dụng toàn diện cho trình tạo khóa học 4 bước. */
export interface RecurringAvailabilityDto {
  validSchedule: boolean;
  scheduleErrorCode?: string | null;
  scheduleErrorMessage?: string | null;
  sessionCount: number;
  firstSessionDate?: string | null;
  lastSessionDate?: string | null;
  selectedSlotAvailable: boolean;
  selectedSlotConflictCode?: string | null;
  selectedSlotConflictReason?: string | null;
  slots: SlotAvailabilityDto[];
  rooms: RoomAvailabilityDto[];
  coaches: CoachAvailabilityDto[];
}

/** Payload cập nhật thông tin khóa học. */
export interface UpdateClassPayload {
  name: string;
  disciplineId: number;
  coachId: number;
  roomId: number;
  capacity: number;
  level?: string;
  description?: string;
  status?: string;
}

/** Thông tin một HLV đang hoạt động. */
export interface CoachUser {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  gender?: string | null;
}

/** Payload tạo lớp cũ (giữ tương thích test). */
export interface CreateClassPayload {
  name: string;
  disciplineId: number;
  coachId: number;
  roomId: number;
  capacity: number;
  level?: string;
  description?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

/** Payload thêm một buổi học cho lớp đã có. */
export interface CreateSessionPayload {
  classId: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

/** Payload dời ngày/giờ một buổi học. */
export interface RescheduleSessionPayload {
  classId: number;
  sessionId: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

interface UserDto {
  id: number;
  roleCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  gender?: string | null;
  status: string;
}

/** Bộ API quản lý lớp học nhóm và lịch học. */
export const classesApi = {
  /** Lấy danh sách khóa học. */
  getClasses: async (): Promise<ClassItem[]> => apiFetch<ClassItem[]>('/classes'),

  /** Lấy danh sách buổi học (có thể lọc theo classId hoặc khoảng ngày). */
  getSessions: async (classId?: number, fromDate?: string, toDate?: string): Promise<ClassSessionDto[]> => {
    const query = new URLSearchParams();
    if (classId) query.set('classId', String(classId));
    if (fromDate) query.set('fromDate', fromDate);
    if (toDate) query.set('toDate', toDate);
    const qs = query.toString();
    const list = await apiFetch<ClassSessionDto[]>(qs ? `/classes/sessions?${qs}` : '/classes/sessions');
    return classId ? list.filter((s) => s.classId === classId) : list;
  },

  /** Kiểm tra khả dụng 5 Slot, phòng tập và HLV trước khi tạo khóa học định kỳ. */
  checkRecurringAvailability: async (payload: RecurringAvailabilityPayload): Promise<RecurringAvailabilityDto> =>
    apiFetch<RecurringAvailabilityDto>('/classes/recurring/availability', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Tạo khóa học định kỳ mới kèm các buổi học theo thứ trong tuần. */
  createRecurringClass: async (payload: CreateRecurringClassPayload): Promise<ClassItem> =>
    apiFetch<ClassItem>('/classes/recurring', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Tạo lớp học (endpoint cũ giữ tương thích). */
  createClass: async (payload: CreateClassPayload): Promise<ClassItem> =>
    apiFetch<ClassItem>('/classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Cập nhật thông tin khóa học. */
  updateClass: async (classId: number, payload: UpdateClassPayload): Promise<ClassItem> =>
    apiFetch<ClassItem>(`/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** Xóa hoặc ngừng kích hoạt khóa học. */
  deleteClass: async (classId: number): Promise<void> => {
    await apiFetch<void>(`/classes/${classId}`, { method: 'DELETE' });
  },

  /** Thêm một buổi học cho khóa học đã có. */
  createSession: (payload: CreateSessionPayload) =>
    apiFetch<ClassSessionDto>(`/classes/${payload.classId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        sessionDate: payload.sessionDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
      }),
    }),

  /** Dời ngày/giờ một buổi học. */
  rescheduleSession: (payload: RescheduleSessionPayload) =>
    apiFetch<ClassSessionDto>(`/classes/${payload.classId}/sessions/${payload.sessionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        sessionDate: payload.sessionDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
      }),
    }),

  /** Hủy một buổi học kèm lý do (tự gửi thông báo tới học viên và HLV). */
  cancelSession: (sessionId: number, reason: string) =>
    apiFetch<ClassSessionDto>(`/classes/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** Lấy danh sách học viên đã ghi danh của một buổi học. */
  getSessionStudents: async (sessionId: number): Promise<ClassEnrolledStudent[]> => {
    const res = await apiFetch<ClassEnrolledStudent[]>(`/classes/sessions/${sessionId}/students`);
    return Array.isArray(res) ? res : [];
  },

  /** Lấy danh sách phòng đang ở trạng thái khả dụng (`available`). */
  getAvailableRooms: async (): Promise<Room[]> => {
    const rooms = await apiFetch<Room[]>('/rooms');
    return rooms.filter((r) => r.status === 'available');
  },

  /** Lấy danh sách HLV đang hoạt động (`active`). */
  getActiveCoaches: async (): Promise<CoachUser[]> => {
    try {
      const coaches = await apiFetch<CoachUser[]>('/classes/coaches');
      if (Array.isArray(coaches)) {
        return coaches
          .filter((u) => (!('roleCode' in u) || (u as unknown as UserDto).roleCode === 'COACH') && u.status === 'active')
          .map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            status: u.status,
            gender: u.gender ?? null,
          }));
      }
    } catch {
      // Fallback sang /users nếu cần.
    }
    const users = await apiFetch<UserDto[]>('/users');
    return users
      .filter((u) => u.roleCode === 'COACH' && u.status === 'active')
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        gender: u.gender ?? null,
      }));
  },

  /** Lấy toàn bộ danh sách bộ môn từ server (không lọc cứng theo tên). */
  getDisciplines: () => apiFetch<Discipline[]>('/disciplines'),
};
