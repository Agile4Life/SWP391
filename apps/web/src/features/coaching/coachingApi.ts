import { apiFetch, getCurrentUser } from '../../shared/api/client';

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

const DEFAULT_STUDENTS_POOL: EnrolledStudent[] = [
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

    try {
      const url = `/classes/sessions${params.toString() ? `?${params.toString()}` : ''}`;
      const sessions = await apiFetch<CoachSession[]>(url);
      if (Array.isArray(sessions) && sessions.length > 0) {
        return sessions;
      }
    } catch {
      // Backend offline or fallback
    }

    const currentUser = getCurrentUser();
    const coachName = currentUser?.name || 'HLV Marcus Vance';
    const cId = Number(currentUser?.id) || 3;

    const baseDate = fromDate ? new Date(fromDate) : new Date();
    const monday = new Date(baseDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    const formatYmd = (d: Date) => d.toISOString().split('T')[0];

    const dMon = new Date(monday);
    const dTue = new Date(monday); dTue.setDate(monday.getDate() + 1);
    const dWed = new Date(monday); dWed.setDate(monday.getDate() + 2);
    const dThu = new Date(monday); dThu.setDate(monday.getDate() + 3);
    const dFri = new Date(monday); dFri.setDate(monday.getDate() + 4);
    const dSat = new Date(monday); dSat.setDate(monday.getDate() + 5);

    return [
      {
        id: 201,
        classId: 1,
        className: 'Reformer Core & Flexibility',
        disciplineId: 1,
        disciplineName: 'Pilates Reformer',
        coachId: cId,
        coachName: coachName,
        roomId: 101,
        roomName: 'Studio 01 (Tầng 2)',
        sessionDate: formatYmd(dMon),
        startTime: '08:00',
        endTime: '09:30',
        status: 'scheduled',
        capacity: 12,
        bookedCount: 10,
        level: 'Mọi cấp độ',
        description: 'Tập trung cơ lõi, thắt lưng và tăng tính linh hoạt các nhóm cơ gập hông.',
      },
      {
        id: 202,
        classId: 2,
        className: 'Metabolic Conditioning (HIIT)',
        disciplineId: 2,
        disciplineName: 'Functional Training',
        coachId: cId,
        coachName: coachName,
        roomId: 102,
        roomName: 'Khu vực Functional (Tầng 1)',
        sessionDate: formatYmd(dMon),
        startTime: '17:30',
        endTime: '18:45',
        status: 'scheduled',
        capacity: 15,
        bookedCount: 14,
        level: 'Trung cấp',
        description: 'Đốt mỡ tăng cường nhịp tim, rèn luyện sức bền tốc độ và phối hợp vận động.',
      },
      {
        id: 203,
        classId: 3,
        className: 'Barbell Strength & Form Mastery',
        disciplineId: 3,
        disciplineName: 'Strength Training',
        coachId: cId,
        coachName: coachName,
        roomId: 103,
        roomName: 'Phòng Tạ Chuyên Sâu (Tầng 1)',
        sessionDate: formatYmd(dTue),
        startTime: '09:00',
        endTime: '10:30',
        status: 'scheduled',
        capacity: 10,
        bookedCount: 8,
        level: 'Nâng cao',
        description: 'Kỹ thuật Squat, Bench Press và Deadlift an toàn dưới sự giám sát chuyên môn.',
      },
      {
        id: 204,
        classId: 1,
        className: 'Reformer Core & Alignment',
        disciplineId: 1,
        disciplineName: 'Pilates Reformer',
        coachId: cId,
        coachName: coachName,
        roomId: 101,
        roomName: 'Studio 01 (Tầng 2)',
        sessionDate: formatYmd(dWed),
        startTime: '08:00',
        endTime: '09:30',
        status: 'scheduled',
        capacity: 12,
        bookedCount: 12,
        level: 'Mọi cấp độ',
        description: 'Buổi học full sĩ số - kiểm soát cột sống và cân bằng cơ thể.',
      },
      {
        id: 205,
        classId: 4,
        className: 'Power Yoga & Breathwork',
        disciplineId: 4,
        disciplineName: 'Yoga Sanctuary',
        coachId: cId,
        coachName: coachName,
        roomId: 104,
        roomName: 'Phòng Thiền & Yoga (Tầng 3)',
        sessionDate: formatYmd(dThu),
        startTime: '18:00',
        endTime: '19:15',
        status: 'scheduled',
        capacity: 16,
        bookedCount: 11,
        level: 'Cơ bản - Trung cấp',
        description: 'Điều hòa hơi thở, kéo giãn các nhóm cơ sau tuần làm việc căng thẳng.',
      },
      {
        id: 206,
        classId: 2,
        className: 'Endurance Circuit & Agility',
        disciplineId: 2,
        disciplineName: 'Functional Training',
        coachId: cId,
        coachName: coachName,
        roomId: 102,
        roomName: 'Khu vực Functional (Tầng 1)',
        sessionDate: formatYmd(dFri),
        startTime: '17:30',
        endTime: '18:45',
        status: 'scheduled',
        capacity: 15,
        bookedCount: 13,
        level: 'Trung cấp',
        description: 'Vòng tập liên hoàn với tạ chuông Kettlebell, bóng tạ Slam Ball và dây kéo kháng lực.',
      },
      {
        id: 207,
        classId: 5,
        className: 'Weekend Athletic Recovery',
        disciplineId: 5,
        disciplineName: 'Recovery & Mobility',
        coachId: cId,
        coachName: coachName,
        roomId: 101,
        roomName: 'Studio 01 (Tầng 2)',
        sessionDate: formatYmd(dSat),
        startTime: '08:30',
        endTime: '10:00',
        status: 'scheduled',
        capacity: 12,
        bookedCount: 9,
        level: 'Mọi cấp độ',
        description: 'Giải phóng màng cơ (Myofascial Release) bằng con lăn Foam Roller và bài tập dẻo dai.',
      },
    ];
  },

  getSessionStudents: async (sessionId: number, classId?: number): Promise<EnrolledStudent[]> => {
    try {
      const res = await apiFetch<EnrolledStudent[]>(
        `/classes/sessions/${sessionId}/students`
      );
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch {
      // Backend fallback
    }

    try {
      if (classId) {
        const res = await apiFetch<EnrolledStudent[]>(
          `/classes/${classId}/students`
        );
        if (Array.isArray(res) && res.length > 0) {
          return res;
        }
      }
    } catch {
      // Ignore
    }

    const count = 4 + (sessionId % 3);
    const startIdx = (sessionId * 2) % DEFAULT_STUDENTS_POOL.length;
    const result: EnrolledStudent[] = [];

    for (let i = 0; i < count; i++) {
      const student = DEFAULT_STUDENTS_POOL[(startIdx + i) % DEFAULT_STUDENTS_POOL.length];
      result.push({
        ...student,
        id: sessionId * 100 + i + 1,
      });
    }

    return result;
  },
};
