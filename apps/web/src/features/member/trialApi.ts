import { apiFetch } from '../../shared/api/client';
import type { MemberSubscription } from './membershipApi';

/**
 * Trạng thái dùng thử của hội viên: đủ điều kiện, đã nhận chưa, giấy tờ (đã che), trạng thái duyệt và lý do từ
 * chối.
 */
export interface TrialStatus {
  eligible: boolean;
  alreadyClaimed: boolean;
  documentNumberMasked?: string | null;
  cccd?: string | null;
  fullName?: string | null;
  documentType?: 'CCCD' | 'PASSPORT' | null;
  nationality?: string | null;
  status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | null;
  requestedAt?: string | null;
  redeemedAt?: string | null;
  subscriptionId?: number | null;
  rejectionReason?: string | null;
}

/** Dữ liệu xin dùng thử: loại và số giấy tờ, họ tên, quốc tịch, ảnh giấy tờ. */
export interface TrialClaimInput {
  documentNumber?: string;
  fullName?: string;
  documentType?: 'CCCD' | 'PASSPORT';
  nationality?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  cccd?: string;
}

/** Gom các hàm API gói dùng thử. */
export const trialApi = {
  // Lấy trạng thái dùng thử.
  getStatus: () => apiFetch<TrialStatus>('/memberships/trial/status'),
  // Gửi yêu cầu dùng thử (số giấy tờ lấy từ documentNumber hoặc cccd).
  claim: (data: TrialClaimInput) =>
    apiFetch<TrialStatus | MemberSubscription>('/memberships/trial/claim', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        documentNumber: data.documentNumber || data.cccd,
      }),
    }),
};

