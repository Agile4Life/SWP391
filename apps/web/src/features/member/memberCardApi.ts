import { apiFetch } from '../../shared/api/client';

/** Gói đăng ký hiển thị trên thẻ hội viên. */
export interface CardSubscription {
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
export const getMySubscription = () =>
  apiFetch<CardSubscription | null>('/memberships/subscriptions/my');

/** Lấy lịch sử các kỳ gói của hội viên. */
export const getMembershipHistory = () =>
  apiFetch<CardSubscription[]>('/memberships/subscriptions/history');

/** Mã QR động của thẻ: mã, thời hạn (giây) và thời điểm tạo. */
export interface DynamicQrResponse {
  qrCode: string;
  expiresInSeconds: number;
  generatedAt: string;
}

/** Lấy mã QR động của thẻ hội viên. */
export const getDynamicQr = () =>
  apiFetch<DynamicQrResponse>('/memberships/subscriptions/my/dynamic-qr');

