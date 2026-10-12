import { apiFetch } from '../../shared/api/client';

export interface MembershipPackage {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  status: 'active' | 'inactive';
}

export interface MemberSubscription {
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

export const getMembershipPackages = () =>
  apiFetch<MembershipPackage[]>('/packages');

export const getCurrentMembership = () =>
  apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');

export const getMembershipHistory = () =>
  apiFetch<MemberSubscription[]>('/memberships/subscriptions/history');

export const createMembershipSubscription = (packageId: number) =>
  apiFetch<MemberSubscription>('/memberships/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ packageId }),
  });

export const renewMembershipSubscription = (subscriptionId: number) =>
  apiFetch<MemberSubscription>(
    `/memberships/subscriptions/${subscriptionId}/renew`,
    {
      method: 'POST',
    },
  );
