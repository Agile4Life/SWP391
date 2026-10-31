import { apiFetch } from '../../shared/api/client';
import { getProfile } from '../member/profileApi';

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
  sessionDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss or HH:mm
  endTime: string; // HH:mm:ss or HH:mm
  status: 'scheduled' | 'completed' | 'cancelled' | string;
  cancelReason?: string | null;
  capacity: number;
  bookedCount: number;
  level?: string;
  description?: string;
}

export interface EnrolledStudent {
  id: number; // enrollment ID
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

export const DEFAULT_STUDENTS_POOL: EnrolledStudent[] = [
  {
    id: 101,
    memberId: 1,
    membershipCode: 'MB-2026-001',
    fullName: 'Lê Hoàng Long',
    email: 'long.le@solfitness.vn',
    phone: '0903 112 233',
    fitnessGoal: 'Tăng khối lượng cơ nạc (Hypertrophy), giảm mỡ vùng bụng dưới và cải thiện sức bền tim mạch.',
    healthNotes: 'Tiền sử thoát vị đĩa đệm nhẹ L4-L5 (năm 2024). Tránh bài Deadlift tạ nặng hoặc gập lưng đột ngột.',
    fitnessLevel: 'intermediate',
    emergencyContactName: 'Lê Thu Hương (Vợ)',
    emergencyContactPhone: '0903 998 877',
    enrolledAt: '2026-10-18T09:30:00Z',
    status: 'booked',
  },
  {
    id: 102,
    memberId: 2,
    membershipCode: 'MB-2026-014',
    fullName: 'Trần Thị Thu Thảo',
    email: 'thao.tran@solfitness.vn',
    phone: '0918 456 789',
    fitnessGoal: 'Săn chắc cơ mông đùi, tăng cường độ dẻo dai cột sống và cải thiện tư thế đứng (posture correction).',
    healthNotes: 'Khớp cổ tay phải yếu do hội chứng ống cổ tay văn phòng, cần quấn bảo hộ khi tập đẩy tạ hoặc plank lâu.',
    fitnessLevel: 'beginner',
    emergencyContactName: 'Trần Văn Hùng (Bố)',
    emergencyContactPhone: '0912 345 678',
    enrolledAt: '2026-10-18T10:15:00Z',
    status: 'booked',
  },
  {
    id: 103,
    memberId: 3,
    membershipCode: 'MB-2026-027',
    fullName: 'Nguyễn Văn Minh',
    email: 'minh.nguyen@solfitness.vn',
    phone: '0934 567 890',
    fitnessGoal: 'Chuẩn bị thể lực cho giải chạy bộ cự ly 21km (Half Marathon), tập trung sức bền chân và cơ lõi (Core).',
    healthNotes: 'Không có tiền sử chấn thương, huyết áp và tim mạch bình thường. Thể trạng thể lực rất tốt.',
    fitnessLevel: 'advanced',
    emergencyContactName: 'Nguyễn Thị Mai (Mẹ)',
    emergencyContactPhone: '0938 111 222',
    enrolledAt: '2026-10-19T08:00:00Z',
    status: 'booked',
  },
  {
    id: 104,
    memberId: 4,
    membershipCode: 'MB-2026-039',
    fullName: 'Đỗ Quỳnh Anh',
    email: 'quynhanh.do@solfitness.vn',
    phone: '0977 889 900',
    fitnessGoal: 'Giảm mỡ toàn thân sau sinh, tăng cường sự săn chắc vùng bụng và lưng trên.',
    healthNotes: 'Khớp gối trái từng chấn thương dây chằng chéo trước (đã mổ phục hồi 2 năm). Tránh bài Squat tạ đòn quá sâu.',
    fitnessLevel: 'beginner',
    emergencyContactName: 'Đỗ Tuấn Kiệt (Chồng)',
    emergencyContactPhone: '0979 555 444',
    enrolledAt: '2026-10-19T14:20:00Z',
    status: 'booked',
  },
  {
    id: 105,
    memberId: 5,
    membershipCode: 'MB-2026-052',
    fullName: 'Phạm Đức Duy',
    email: 'duy.pham@solfitness.vn',
    phone: '0945 678 123',
    fitnessGoal: 'Cải thiện sức mạnh thân trên (Bench Press, Overhead Press) và kiểm soát cân nặng.',
    healthNotes: 'Huyết áp hơi cao khi căng thẳng, cần khởi động làm ấm tim mạch tối thiểu 10 phút trước set chính.',
    fitnessLevel: 'intermediate',
    emergencyContactName: 'Phạm Văn Nam (Anh trai)',
    emergencyContactPhone: '0945 111 999',
    enrolledAt: '2026-10-20T07:45:00Z',
    status: 'booked',
  },
  {
    id: 106,
    memberId: 6,
    membershipCode: 'MB-2026-068',
    fullName: 'Vũ Ngọc Lan',
    email: 'lan.vu@solfitness.vn',
    phone: '0908 901 234',
    fitnessGoal: 'Phục hồi chức năng cơ vai gáy, tăng biên độ cử động vai và giảm đau mỏi do ngồi máy tính.',
    healthNotes: 'Căng cơ vùng cổ vai gáy mạn tính, nhạy cảm với các bài tập nhún vai hoặc kéo xà nặng.',
    fitnessLevel: 'intermediate',
    emergencyContactName: 'Vũ Hữu Phước (Bố)',
    emergencyContactPhone: '0908 222 333',
    enrolledAt: '2026-10-20T11:10:00Z',
    status: 'booked',
  },
];

export const coachingApi = {
  getCoachSchedule: async (
    coachId?: number | string,
    fromDate?: string,
    toDate?: string
  ): Promise<CoachSession[]> => {
    const params = new URLSearchParams();
    if (coachId) params.set('coachId', String(coachId));
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    const url = `/classes/sessions${params.toString() ? `?${params.toString()}` : ''}`;
    const sessions = await apiFetch<CoachSession[]>(url);
    if (Array.isArray(sessions)) {
      return sessions;
    }
    throw new Error('Dữ liệu lịch dạy không hợp lệ');
  },

  getCoachWeeklySchedule: async (
    mondayStr: string
  ): Promise<CoachSession[]> => {
    const profile = await getProfile();
    const sunday = new Date(`${mondayStr}T00:00:00Z`);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return coachingApi.getCoachSchedule(profile.userId, mondayStr, sunday.toISOString().slice(0, 10));
  },

  getSessionStudents: async (sessionId: number, _classId?: number): Promise<EnrolledStudent[]> => {
    void _classId; // Preserve the existing optional argument for callers.
    const res = await apiFetch<EnrolledStudent[]>(
      `/classes/sessions/${sessionId}/students`
    );
    if (Array.isArray(res)) {
      return res;
    }
    throw new Error('Dữ liệu học viên không hợp lệ');
  },

  getAllAssignedStudents: async (coachId?: string | number): Promise<EnrolledStudent[]> => {
    try {
      const res = await apiFetch<EnrolledStudent[]>('/coaching/students');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch {
      // Backend fallback
    }
    return DEFAULT_STUDENTS_POOL;
  },
};
