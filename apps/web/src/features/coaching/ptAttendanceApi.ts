import { apiFetch } from '../../shared/api/client';
import type { CoachBookingDto } from '../member/coachBookingApi';

export type PtOutcome = 'ALL' | 'ATTENDED' | 'MISSED' | 'UPCOMING';

/** 1:1 sessions with their arrival: a coach gets their own, the desk and managers get everyone's. */
export const getPtAttendance = (from: string, to: string, outcome: PtOutcome) =>
  apiFetch<CoachBookingDto[]>(`/coach-bookings/attendance?from=${from}&to=${to}&outcome=${outcome}`);
