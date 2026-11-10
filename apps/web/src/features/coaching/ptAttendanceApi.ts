import { apiFetch } from '../../shared/api/client';
import type { CoachBookingDto } from '../member/coachBookingApi';

export type PtOutcome = 'ALL' | 'ATTENDED' | 'MISSED' | 'UPCOMING';

/** 1:1 sessions with their arrival: a coach gets their own, the desk and managers get everyone's. */
export const getPtAttendance = (from: string, to: string, outcome: PtOutcome) =>
  apiFetch<CoachBookingDto[]>(`/coach-bookings/attendance?from=${from}&to=${to}&outcome=${outcome}`);

/** For a member who forgot to scan: records that the member attended a session that has started. */
export const markPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/mark-attended`, { method: 'POST' });

/** Removes a wrong arrival; the session stays locked so a scan or the sweep does not record it again. */
export const unmarkPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/unmark-attended`, { method: 'POST' });
