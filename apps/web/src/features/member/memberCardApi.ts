import { apiFetch } from '../../shared/api/client';

export interface CardSubscription {
  id: number;
  memberId: number;
  packageId: number;
  packageName: string;
  previousSubscriptionId: number | null;
  startDate: string;
  endDate: string;
  status: string;
  qrCode: string | null;
  createdAt: string;
}

export const getMySubscription = () =>
  apiFetch<CardSubscription | null>('/memberships/subscriptions/my');

export const getMembershipHistory = () =>
  apiFetch<CardSubscription[]>('/memberships/subscriptions/history');
