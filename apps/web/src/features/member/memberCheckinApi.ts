import { apiFetch } from '../../shared/api/client';
import type { CheckinDto } from '../reception/checkinApi';

/** Gom các hàm API tự check-in/out của hội viên bằng cách quét QR cổng. */
export const memberCheckinApi = {
  // Tự check-in bằng mã QR cổng.
  scan: (gateQr: string) => apiFetch<CheckinDto>('/check-in/self', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ gateQr }),
  }),
  // Tự check-out bằng mã QR cổng.
  checkout: (gateQr: string) => apiFetch<CheckinDto>('/check-in/self/checkout', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ gateQr }),
  }),
  // Lịch sử check-in vẫn dùng tại MemberCheckInPage; không xóa cùng Workout History.
  history: (range?: { fromDate: string; toDate: string }, options?: { signal?: AbortSignal }) => apiFetch<CheckinDto[]>(
    range ? `/check-in/history?fromDate=${range.fromDate}&toDate=${range.toDate}` : '/check-in/history',
    { cache: 'no-store', signal: options?.signal }),
};
