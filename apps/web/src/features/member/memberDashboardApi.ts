import { apiFetch } from '../../shared/api/client';

/** Gói đăng ký hiển thị trên bảng điều khiển. */
export interface MemberSubscription {
  id: number;
  memberId: number;
  packageId: number;
  packageName: string;
  previousSubscriptionId: number | null;
  startDate: string;
  endDate: string;
  paidThroughDate?: string | null;
  status: string;
  qrCode: string | null;
  createdAt: string;
}

/** Lấy gói hiện tại của hội viên (null nếu chưa có). */
export const getCurrentMembership = () =>
  apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');
