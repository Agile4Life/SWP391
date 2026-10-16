import { apiFetch } from '../../shared/api/client';

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

export interface BookedClass {
  id: number;
  classId: number;
  className: string;
  coachName: string | null;
  roomName: string | null;
  sessionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export const getCurrentMembership = () =>
  apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');

export const getBookedEnrollments = () =>
  apiFetch<BookedClass[]>('/classes/enrollments/my?status=booked&upcoming=true');
