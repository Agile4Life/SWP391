import { apiFetch } from '../../shared/api/client';

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

export const getCurrentMembership = () =>
  apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');
