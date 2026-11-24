import { apiFetch } from '../../shared/api/client';
import type { CoachBookingDto } from '../member/coachBookingApi';

/** Bộ lọc kết quả buổi kèm: tất cả, đã có mặt, vắng hoặc sắp tới. */
export type PtOutcome = 'ALL' | 'ATTENDED' | 'MISSED' | 'UPCOMING';

/**
 * Lấy các buổi kèm 1:1 trong khoảng ngày kèm trạng thái đến: HLV thấy của mình, lễ tân và quản lý thấy của mọi
 * người.
 *
 * 1:1 sessions with their arrival: a coach gets their own, the desk and managers get everyone's.
 */
export const getPtAttendance = (from: string, to: string, outcome: PtOutcome) =>
  apiFetch<CoachBookingDto[]>(`/coach-bookings/attendance?from=${from}&to=${to}&outcome=${outcome}`);

/**
 * HLV hoặc lễ tân ghi nhận hội viên đã có mặt ở buổi đã bắt đầu; quẹt cổng không tự ghi nhận.
 *
 * The coach or the desk records that the member attended a session that has started; a gate scan never does.
 */
export const markPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/mark-attended`, { method: 'POST' });

/**
 * Bỏ một ghi nhận có mặt sai; buổi được đánh dấu là cố ý bỏ ghi nhận.
 *
 * Removes a wrong arrival; the session is flagged so the list shows the mark was taken off on purpose.
 */
export const unmarkPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/unmark-attended`, { method: 'POST' });
