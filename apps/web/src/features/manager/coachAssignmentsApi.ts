import { apiFetch } from '../../shared/api/client';

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
  /** Set only when the plan blocks coaching: on hold, no valid plan, or ending before the PT day. */
  membershipIssue?: 'FROZEN' | 'NO_ACTIVE' | 'NOT_COVERED' | null;
  nextSession: string | null;
  status: string;
  referenceId: number;
}

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

export interface CoachAssignmentSummaryStats {
  totalCoaches: number;
  activeCoaches: number;
  totalAssignedStudents: number;
  totalPtStudents: number;
  totalPlanStudents: number;
  totalClassStudents: number;
}

export interface CoachAssignmentData {
  coaches: CoachAssignmentOverview[];
  availableCoaches: { coachId: number; coachName: string; specialization: string | null }[];
  stats: CoachAssignmentSummaryStats;
}

export interface ReassignStudentRequest {
  memberId: number;
  fromCoachId: number;
  toCoachId: number;
  referenceId: number;
  assignmentType: 'TRAINING_PLAN' | 'PT_1_1';
  reason?: string;
}

export const coachAssignmentsApi = {
  getOverview: (params?: { coachId?: number; search?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.coachId) query.set('coachId', String(params.coachId));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return apiFetch<CoachAssignmentData>(`/manager/coach-assignments${qs ? `?${qs}` : ''}`);
  },

  reassignStudent: (body: ReassignStudentRequest) =>
    apiFetch<void>('/manager/coach-assignments/reassign', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  removeAssignment: (planId: number) =>
    apiFetch<void>(`/manager/coach-assignments/${planId}`, {
      method: 'DELETE',
    }),
};

