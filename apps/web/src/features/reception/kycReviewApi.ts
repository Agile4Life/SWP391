import { apiFetch } from '../../shared/api/client';

/**
 * Một hồ sơ định danh đang chờ duyệt: hội viên, loại giấy tờ, số giấy tờ (chỉ hiển thị tại đây cho người duyệt),
 * quốc tịch, ảnh hai mặt và thời điểm nộp.
 */
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

/** Lấy danh sách hồ sơ KYC chờ duyệt. */
export const listPendingKyc = () => apiFetch<KycSubmission[]>('/members/kyc/pending');
/** Duyệt hồ sơ KYC của một hội viên. */
export const approveKyc = (memberId: number) => apiFetch<null>(`/members/kyc/${memberId}/approve`, { method: 'POST' });
/** Từ chối hồ sơ KYC kèm lý do. */
export const rejectKyc = (memberId: number, reason: string) =>
  apiFetch<null>(`/members/kyc/${memberId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
