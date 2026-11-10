import { apiFetch, apiFetchBlob } from '../../shared/api/client';

export type HoldStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface HoldDocument {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface HoldPolicy {
  allowed: boolean;
  alreadyUsed: boolean;
  minDays: number;
  maxDays: number;
  noticeHours: number;
  maxDocuments: number;
  maxDocumentBytes: number;
}

/** One hold request or hold-history row, as shown to the member and to desk staff. */
export interface HoldDetail {
  id: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string | null;
  memberEmail: string | null;
  memberPhone: string | null;
  packageId: number | null;
  packageName: string | null;
  startDate: string;
  endDate: string;
  status: string;
  holdStatus: HoldStatus | null;
  holdReason: string | null;
  holdRequestedAt: string | null;
  holdResolvedAt: string | null;
  cancelledEnrollmentsCount: number;
  holdStartDate: string | null;
  holdEndDate: string | null;
  documents: HoldDocument[];
}

export interface HoldSubmission {
  reason: string;
  startDate: string;
  endDate: string;
  files: File[];
}

const base = '/memberships/subscriptions';

export const getHoldPolicy = (subscriptionId: number) =>
  apiFetch<HoldPolicy>(`${base}/${subscriptionId}/hold/policy`);

export const getHoldDetail = (subscriptionId: number) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold`);

export function submitHoldRequest(subscriptionId: number, submission: HoldSubmission) {
  const form = new FormData();
  form.append('reason', submission.reason);
  form.append('startDate', submission.startDate);
  form.append('endDate', submission.endDate);
  submission.files.forEach((file) => form.append('documents', file, file.name));
  return apiFetch<unknown>(`${base}/${subscriptionId}/hold`, { method: 'POST', body: form });
}

export const withdrawHoldRequest = (subscriptionId: number) =>
  apiFetch<unknown>(`${base}/${subscriptionId}/hold`, { method: 'DELETE' });

export const listHolds = (status: HoldStatus | 'ALL') =>
  apiFetch<HoldDetail[]>(`${base}/holds?status=${status}`);

export const approveHold = (subscriptionId: number) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold/approve`, { method: 'POST' });

export const rejectHold = (subscriptionId: number) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold/reject`, { method: 'POST' });

/** Medical documents are private: fetch with the session token and open the blob, never link them directly. */
export const fetchHoldDocument = (subscriptionId: number, documentId: number) =>
  apiFetchBlob(`${base}/${subscriptionId}/hold/documents/${documentId}`);

/** The desk withdraws a hold for a member who asked at the counter (pending, or approved and not started). */
export const withdrawHoldForMember = (subscriptionId: number) =>
  apiFetch<unknown>(`${base}/${subscriptionId}/hold/withdraw`, { method: 'POST' });
