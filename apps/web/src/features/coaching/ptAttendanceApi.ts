import { apiFetch } from '../../shared/api/client';
import type { CoachBookingDto } from '../member/coachBookingApi';

/** Bộ lọc kết quả buổi kèm: tất cả, đã có mặt, vắng hoặc sắp tới. */
export type PtOutcome = 'ALL' | 'ATTENDED' | 'MISSED' | 'UPCOMING';

/**
 * Lấy các buổi kèm 1:1 trong khoảng ngày kèm trạng thái đến: HLV thấy của mình, lễ tân và quản lý thấy của mọi
 * người.
 */
export const getPtAttendance = (from: string, to: string, outcome: PtOutcome) =>
  apiFetch<CoachBookingDto[]>(`/coach-bookings/attendance?from=${from}&to=${to}&outcome=${outcome}`);

/**
 * HLV hoặc lễ tân ghi nhận hội viên đã có mặt ở buổi đã bắt đầu; quẹt cổng không tự ghi nhận.
 */
export const markPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/mark-attended`, { method: 'POST' });

/**
 * Bỏ một ghi nhận có mặt sai; buổi được đánh dấu là cố ý bỏ ghi nhận để danh sách thể hiện rõ.
 */
export const unmarkPtAttended = (bookingId: number) =>
  apiFetch<CoachBookingDto>(`/coach-bookings/${bookingId}/unmark-attended`, { method: 'POST' });
