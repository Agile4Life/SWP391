import { staffMessage, staffSourceError, type StaffMessage } from '../operations/staffI18n';
import { apiFetch } from '../../shared/api/client';
import { getProfile } from '../member/profileApi';

/** Giữ nguyên nội dung Error từ backend; chỉ dùng fallback song ngữ khi lỗi không phải lỗi nghiệp vụ. */
export function coachingError(error: unknown, vi: string, en: string): StaffMessage {
  return error instanceof Error && error.name === 'Error' && error.message
    ? error
    : staffMessage(vi, en);
}

/** Bản ghi hội viên từ danh bạ `/coaching/members` (gồm cả học viên PT 1:1 lẫn lớp nhóm). */
interface CoachDirectoryMember {
  id: number;
  memberCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  fitnessGoal?: string | null;
  healthNotes?: string | null;
  fitnessLevel?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

/** Buổi dạy của HLV: lớp, bộ môn, phòng, ngày giờ, trạng thái, sức chứa và số chỗ đã đặt. */
export interface CoachSession {
  id: number;
  classId: number;
  className: string;
  disciplineId?: number;
  disciplineName?: string;
  coachId: number;
  coachName?: string;
  roomId?: number;
  roomName?: string;
  sessionDate: string; // Định dạng YYYY-MM-DD
  startTime: string; // Định dạng HH:mm:ss hoặc HH:mm
  endTime: string; // Định dạng HH:mm:ss hoặc HH:mm
  status: 'scheduled' | 'completed' | 'cancelled' | string;
  cancelReason?: string | null;
  capacity: number;
  bookedCount: number;
  level?: string;
  description?: string;
}

/** Học viên đã ghi danh: thông tin hội viên, mục tiêu, sức khỏe, trình độ, liên hệ khẩn cấp và trạng thái. */
export interface EnrolledStudent {
  id: number; // Mã ghi danh (enrollment ID)
  memberId: number;
  membershipCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  fitnessGoal: string;
  healthNotes: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  enrolledAt: string;
  status: 'booked' | 'attended' | 'cancelled' | string;
}

/** Gom các hàm API lịch dạy và học viên của HLV. */
export const coachingApi = {
  getCoachSchedule: async (
    coachId?: number | string,
    fromDate?: string,
    toDate?: string
  ): Promise<CoachSession[]> => {
    const params = new URLSearchParams();
    if (coachId !== undefined && coachId !== null && coachId !== '') {
      const numericCoachId = typeof coachId === 'number' ? coachId : Number(String(coachId).trim());
      if (Number.isInteger(numericCoachId) && numericCoachId > 0) {
        params.set('coachId', String(numericCoachId));
      }
    }
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    const url = `/classes/sessions${params.toString() ? `?${params.toString()}` : ''}`;
    const sessions = await apiFetch<CoachSession[]>(url);
    if (Array.isArray(sessions)) {
      return sessions;
    }
    throw staffSourceError('Dữ liệu lịch dạy không hợp lệ', 'Invalid teaching schedule data.');
  },

  getCoachWeeklySchedule: async (
    mondayStr: string
  ): Promise<CoachSession[]> => {
    const profile = await getProfile();
    const sunday = new Date(`${mondayStr}T00:00:00Z`);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return coachingApi.getCoachSchedule(profile.userId, mondayStr, sunday.toISOString().slice(0, 10));
  },

  // Lấy học viên của một buổi học.
  getSessionStudents: async (sessionId: number, _classId?: number): Promise<EnrolledStudent[]> => {
    void _classId; // Giữ nguyên tham số tùy chọn hiện có cho các nơi gọi hàm.
    const res = await apiFetch<EnrolledStudent[]>(
      `/classes/sessions/${sessionId}/students`
    );
    if (Array.isArray(res)) {
      return res;
    }
    throw staffSourceError('Dữ liệu học viên không hợp lệ', 'Invalid member data.');
  },

  // Lấy toàn bộ học viên mà HLV đang phụ trách qua danh bạ chuẩn `/coaching/members` (bao gồm cả PT 1:1 và lớp nhóm).
  getAllAssignedStudents: async (): Promise<EnrolledStudent[]> => {
    const members = await apiFetch<CoachDirectoryMember[]>('/coaching/members');
    if (!Array.isArray(members)) {
      throw staffSourceError('Dữ liệu học viên không hợp lệ', 'Invalid member data.');
    }
    const deduped = new Map<number, EnrolledStudent>();
    for (const m of members) {
      if (m == null || m.id == null) continue;
      deduped.set(m.id, {
        id: m.id,
        memberId: m.id,
        membershipCode: m.memberCode ?? '',
        fullName: m.fullName ?? '',
        email: m.email ?? '',
        phone: m.phone ?? null,
        avatarUrl: m.avatarUrl ?? null,
        fitnessGoal: m.fitnessGoal ?? '',
        healthNotes: m.healthNotes ?? '',
        fitnessLevel: m.fitnessLevel ?? '',
        emergencyContactName: m.emergencyContactName ?? null,
        emergencyContactPhone: m.emergencyContactPhone ?? null,
        enrolledAt: '',
        status: 'active',
      });
    }
    return [...deduped.values()];
  },
};
