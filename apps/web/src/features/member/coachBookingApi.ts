import { apiFetch } from '../../shared/api/client';

export interface CoachPublicDto {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  bio: string;
  certification: string;
  avatarUrl: string | null;
  defaultHourlyRate: number;
}

export interface CoachAvailableSlotDto {
  startTime: string; // "08:00"
  endTime: string;   // "09:00"
  available: boolean;
  reason: 'too_soon' | 'coach_busy' | 'coach_rest' | 'member_busy' | 'coach_on_leave' | null;
}

export interface CoachBookingDto {
  id: number;
  memberId: number;
  memberName: string;
  coachId: number;
  coachName: string;
  coachSpecialization: string;
  coachAvatarUrl: string | null;
  disciplineId: number | null;
  disciplineName: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  paymentMethod: string;
  paymentStatus: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** When the member was recorded as present (gate scan during the session); null when not recorded. */
  attendedAt?: string | null;
  /** Staff removed the mark; scans and the sweep must not restore it automatically. */
  attendanceLocked?: boolean;
}

export interface CoachBookingCreatePayload {
  coachId: number;
  disciplineId?: number | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CoachQuotaStatusDto {
  packageName: string | null;
  monthlyQuota: number;
  usedThisMonth: number;
  remainingQuota: number;
}

export async function getCoaches(): Promise<CoachPublicDto[]> {
  const res = await apiFetch<CoachPublicDto[]>('/coach-bookings/coaches');
  return res ?? [];
}

export async function getAvailableSlots(coachId: number, date: string): Promise<CoachAvailableSlotDto[]> {
  const res = await apiFetch<CoachAvailableSlotDto[]>(`/coach-bookings/available-slots?coachId=${coachId}&date=${date}`);
  return res ?? [];
}

export async function createCoachBooking(payload: CoachBookingCreatePayload): Promise<CoachBookingDto> {
  return apiFetch<CoachBookingDto>('/coach-bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyCoachBookings(): Promise<CoachBookingDto[]> {
  const res = await apiFetch<CoachBookingDto[]>('/coach-bookings/my');
  return res ?? [];
}

export async function cancelCoachBooking(bookingId: number, reason?: string): Promise<CoachBookingDto> {
  const url = reason
    ? `/coach-bookings/${bookingId}?reason=${encodeURIComponent(reason)}`
    : `/coach-bookings/${bookingId}`;
  return apiFetch<CoachBookingDto>(url, {
    method: 'DELETE',
  });
}

export async function getMemberQuotaStatus(): Promise<CoachQuotaStatusDto> {
  return apiFetch<CoachQuotaStatusDto>('/coach-bookings/quota-status');
}

export async function getCoachSchedule(): Promise<CoachBookingDto[]> {
  const res = await apiFetch<CoachBookingDto[]>('/coach-bookings/coach-schedule');
  return res ?? [];
}
