import { apiFetch } from '../../shared/api/client';

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

export const getMySubscription = () =>
  apiFetch<CardSubscription | null>('/memberships/subscriptions/my');

export const getMembershipHistory = () =>
  apiFetch<CardSubscription[]>('/memberships/subscriptions/history');

export interface DynamicQrResponse {
  qrCode: string;
  expiresInSeconds: number;
  generatedAt: string;
}

export const getDynamicQr = () =>
  apiFetch<DynamicQrResponse>('/memberships/subscriptions/my/dynamic-qr');

