import { apiFetch, ApiError } from '../../shared/api/client';
import type { Discipline, Room } from '../manager/catalogApi';

export interface ClassSessionDto {
  id: number;
  classId: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  cancelReason?: string | null;
}

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
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  schedule?: string;
  activeSessions?: number;
}

export interface CoachUser {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
}

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

export interface CreateSessionPayload {
  classId: number;
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
  status: string;
}

const FALLBACK_CLASSES_KEY = 'scms_fallback_classes';
const FALLBACK_SESSIONS_KEY = 'scms_fallback_sessions';

const defaultSeedClasses = (): ClassItem[] => [
  {
    id: 1,
    name: 'Reformer Core Architecture',
    disciplineId: 1,
    disciplineName: 'Pilates',
    coachId: 1,
    coachName: 'Elena Vũ',
    roomId: 1,
    roomName: 'Studio 01 (Level 2)',
    schedule: '2026-10-10 (17:30 - 18:30)',
    capacity: 12,
    activeSessions: 36,
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'Olympic Barbell & Plyometrics',
    disciplineId: 2,
    disciplineName: 'Strength & Conditioning',
    coachId: 2,
    coachName: 'Minh Trí',
    roomId: 2,
    roomName: 'Arena 02 (Level 1)',
    schedule: '2026-10-12 (08:00 - 09:30)',
    capacity: 16,
    activeSessions: 24,
    status: 'ACTIVE',
  },
  {
    id: 3,
    name: 'Yin Yoga & Sound Healing',
    disciplineId: 3,
    disciplineName: 'Yoga',
    coachId: 3,
    coachName: 'An Nhiên',
    roomId: 3,
    roomName: 'Zen Garden Studio',
    schedule: '2026-10-14 (19:00 - 20:15)',
    capacity: 15,
    activeSessions: 18,
    status: 'ACTIVE',
  },
];

export const classesApi = {
  /**
   * Lấy danh sách lớp học (gọi API thật, tự động fallback nếu backend chưa có endpoint /classes)
   */
  getClasses: async (): Promise<ClassItem[]> => {
    try {
      return await apiFetch<ClassItem[]>('/classes');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
        const raw = localStorage.getItem(FALLBACK_CLASSES_KEY);
        if (raw) {
          try {
            return JSON.parse(raw);
          } catch {
            // ignore JSON error
          }
        }
        const initial = defaultSeedClasses();
        localStorage.setItem(FALLBACK_CLASSES_KEY, JSON.stringify(initial));
        return initial;
      }
      throw err;
    }
  },

  /**
   * Lấy danh sách buổi học / lịch học
   */
  getSessions: async (classId?: number): Promise<ClassSessionDto[]> => {
    try {
      return await apiFetch<ClassSessionDto[]>(
        classId ? `/classes/sessions?classId=${classId}` : '/classes/sessions'
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
        const raw = localStorage.getItem(FALLBACK_SESSIONS_KEY);
        const list: ClassSessionDto[] = raw ? JSON.parse(raw) : [];
        return classId ? list.filter((s) => s.classId === classId) : list;
      }
      throw err;
    }
  },

  /**
   * Tạo lớp học mới kèm xếp lịch buổi học
   */
  createClass: async (payload: CreateClassPayload): Promise<ClassItem> => {
    try {
      return await apiFetch<ClassItem>('/classes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
        // Mô phỏng kiểm tra trùng lịch (BR-04) khi backend chưa có API
        const rawSessions = localStorage.getItem(FALLBACK_SESSIONS_KEY);
        const sessions: ClassSessionDto[] = rawSessions ? JSON.parse(rawSessions) : [];

        // Nếu trùng ngày và giao thoa khung giờ
        const hasConflict = sessions.some(
          (s) =>
            s.sessionDate === payload.sessionDate &&
            !(payload.endTime <= s.startTime || payload.startTime >= s.endTime)
        );

        if (hasConflict) {
          throw new ApiError(
            'Trùng lịch: Huấn luyện viên hoặc phòng học đã có lịch trong khung giờ này.',
            409,
            'error.scheduling.session_conflict'
          );
        }

        const raw = localStorage.getItem(FALLBACK_CLASSES_KEY);
        const currentList: ClassItem[] = raw ? JSON.parse(raw) : defaultSeedClasses();

        const newClass: ClassItem = {
          id: Date.now(),
          name: payload.name,
          disciplineId: payload.disciplineId,
          coachId: payload.coachId,
          roomId: payload.roomId,
          capacity: payload.capacity,
          level: payload.level,
          description: payload.description,
          schedule: `${payload.sessionDate} (${payload.startTime} - ${payload.endTime})`,
          status: 'ACTIVE',
        };

        const updatedList = [newClass, ...currentList];
        localStorage.setItem(FALLBACK_CLASSES_KEY, JSON.stringify(updatedList));

        const newSession: ClassSessionDto = {
          id: Date.now() + 1,
          classId: newClass.id,
          sessionDate: payload.sessionDate,
          startTime: payload.startTime,
          endTime: payload.endTime,
          status: 'scheduled',
        };
        localStorage.setItem(FALLBACK_SESSIONS_KEY, JSON.stringify([...sessions, newSession]));

        return newClass;
      }
      throw err;
    }
  },

  /**
   * Thêm buổi học mới cho lớp
   */
  createSession: (payload: CreateSessionPayload) =>
    apiFetch<ClassSessionDto>('/classes/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * BR-02: Lấy danh sách phòng chỉ bao gồm phòng 'available'
   */
  getAvailableRooms: async (): Promise<Room[]> => {
    const rooms = await apiFetch<Room[]>('/rooms');
    return rooms.filter((r) => r.status === 'available');
  },

  /**
   * BR-02: Lấy danh sách huấn luyện viên chỉ bao gồm HLV role 'COACH' và status 'active'
   */
  getActiveCoaches: async (): Promise<CoachUser[]> => {
    const users = await apiFetch<UserDto[]>('/users');
    return users
      .filter((u) => u.roleCode === 'COACH' && u.status === 'active')
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
      }));
  },

  /**
   * Lấy danh sách bộ môn thể thao
   */
  getDisciplines: () => apiFetch<Discipline[]>('/disciplines'),
};
