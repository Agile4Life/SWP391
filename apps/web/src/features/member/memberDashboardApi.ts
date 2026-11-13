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

/** Upcoming classes of the member. Every class is a recurring course, so only course enrollments exist. */
export const getBookedEnrollments = async (): Promise<BookedClass[]> => {
  const enrollments = await apiFetch<BookedClass[]>('/classes/enrollments/my?status=booked&upcoming=true');
  return Array.isArray(enrollments) ? enrollments : [];
};
