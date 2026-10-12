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
  className: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string;
  status: string;
}

function dateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const getCurrentMembership = () =>
  apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');

export const getUpcomingBookings = () => {
  const today = new Date();
  const until = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 7,
  );

  return apiFetch<BookedClass[]>(
    `/enrollments/my?from=${dateParam(today)}&to=${dateParam(until)}`,
  );
};