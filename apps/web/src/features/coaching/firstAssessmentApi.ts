import { apiFetch } from '../../shared/api/client';

/** A registered member nobody has measured yet. */
export interface FirstAssessmentCandidate {
  memberId: number;
  membershipCode: string | null;
  fullName: string | null;
  phone: string | null;
}

export const searchFirstAssessmentCandidates = (query: string) =>
  apiFetch<FirstAssessmentCandidate[]>(`/health/first-assessment/candidates?q=${encodeURIComponent(query.trim())}`);
