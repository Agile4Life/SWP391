import { apiFetch } from '../../shared/api/client';
import type { CoachBookingDto } from '../member/coachBookingApi';

export type PtOutcome = 'ALL' | 'ATTENDED' | 'MISSED' | 'UPCOMING';

/** 1:1 sessions with their arrival: a coach gets their own, the desk and managers get everyone's. */
export const getPtAttendance = (from: string, to: string, outcome: PtOutcome) =>
  apiFetch<CoachBookingDto[]>(`/coach-bookings/attendance?from=${from}&to=${to}&outcome=${outcome}`);

/** The coach or the desk records that the member attended a session that has started; a gate scan never does. */
export const markPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/mark-attended`, { method: 'POST' });

/** Removes a wrong arrival; the session is flagged so the list shows the mark was taken off on purpose. */
export const unmarkPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/unmark-attended`, { method: 'POST' });
