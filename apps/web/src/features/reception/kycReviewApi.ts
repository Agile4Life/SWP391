import { apiFetch } from '../../shared/api/client';

/** One identity submission waiting for review; the number is readable only here, for the reviewer. */
export interface KycSubmission {
  memberId: number;
  membershipCode: string | null;
  fullName: string | null;
  documentType: string | null;
  citizenId: string | null;
  nationality: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  submittedAt: string | null;
}

export const listPendingKyc = () => apiFetch<KycSubmission[]>('/members/kyc/pending');
export const approveKyc = (memberId: number) => apiFetch<null>(`/members/kyc/${memberId}/approve`, { method: 'POST' });
export const rejectKyc = (memberId: number, reason: string) =>
  apiFetch<null>(`/members/kyc/${memberId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
