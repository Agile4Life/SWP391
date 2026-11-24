import { apiFetch } from '../../shared/api/client';

/**
 * Một học viên được phân công: thông tin hội viên, loại phân công (PT 1:1, giáo án, lớp), thời gian, trạng thái
 * và vấn đề gói tập.
 */
export interface CoachAssignmentStudent {
  memberId: number;
  membershipCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  fitnessGoal: string | null;
  fitnessLevel: string | null;
  healthNotes: string | null;
  assignmentType: 'PT_1_1' | 'TRAINING_PLAN' | 'CLASS';
  assignmentTypeLabel: string;
  detail: string;
  startDate: string | null;
  endDate: string | null;
  /** Chỉ được gán khi gói tập chặn việc huấn luyện: đang bảo lưu, không còn gói hợp lệ, hoặc hết hạn trước ngày buổi PT. */
  membershipIssue?: 'FROZEN' | 'NO_ACTIVE' | 'NOT_COVERED' | null;
  nextSession: string | null;
  status: string;
  referenceId: number;
}

/** Tổng quan một HLV: liên hệ, chuyên môn, trạng thái và số học viên theo loại. */
export interface CoachAssignmentOverview {
  coachId: number;
  coachName: string;
  coachEmail: string;
  coachPhone: string;
  specialization: string;
  bio: string | null;
  employmentStatus: string;
  totalStudentsCount: number;
  ptStudentsCount: number;
  planStudentsCount: number;
  classStudentsCount: number;
  students: CoachAssignmentStudent[];
}

/** Số liệu tổng hợp phân công HLV. */
export interface CoachAssignmentSummaryStats {
  totalCoaches: number;
  activeCoaches: number;
  totalAssignedStudents: number;
  totalPtStudents: number;
  totalPlanStudents: number;
  totalClassStudents: number;
}

/** Dữ liệu màn phân công: danh sách HLV, HLV có thể chọn và số liệu tổng hợp. */
export interface CoachAssignmentData {
  coaches: CoachAssignmentOverview[];
  availableCoaches: { coachId: number; coachName: string; specialization: string | null }[];
  stats: CoachAssignmentSummaryStats;
}

/** Yêu cầu điều chuyển: hội viên, HLV cũ/mới, id giáo án hoặc buổi PT, loại và lý do. */
export interface ReassignStudentRequest {
  memberId: number;
  fromCoachId: number;
  toCoachId: number;
  referenceId: number;
  assignmentType: 'TRAINING_PLAN' | 'PT_1_1';
  reason?: string;
}

/** Gom các hàm API phân công HLV. */
export const coachAssignmentsApi = {
  // Lấy tổng quan phân công theo HLV, từ khóa, loại và sắp xếp.
  getOverview: (params?: { coachId?: number; search?: string; type?: string; sortBy?: string; sortDir?: string }) => {
    const query = new URLSearchParams();
    if (params?.coachId) query.set('coachId', String(params.coachId));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortDir) query.set('sortDir', params.sortDir);
    const qs = query.toString();
    return apiFetch<CoachAssignmentData>(`/manager/coach-assignments${qs ? `?${qs}` : ''}`);
  },

  // Điều chuyển học viên sang HLV khác.
  reassignStudent: (body: ReassignStudentRequest) =>
    apiFetch<void>('/manager/coach-assignments/reassign', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Kết thúc phân công giáo án đang hoạt động.
  removeAssignment: (planId: number) =>
    apiFetch<void>(`/manager/coach-assignments/${planId}`, {
      method: 'DELETE',
    }),
};

