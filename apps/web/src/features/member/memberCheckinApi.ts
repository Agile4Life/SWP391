import { apiFetch } from '../../shared/api/client';
import type { CheckinDto } from '../reception/checkinApi';

export const memberCheckinApi = {
  scan: (gateQr: string) => apiFetch<CheckinDto>('/check-in/self', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ gateQr }),
  }),
  checkout: (gateQr: string) => apiFetch<CheckinDto>('/check-in/self/checkout', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ gateQr }),
  }),
  // Lịch sử check-in vẫn dùng tại MemberCheckInPage; không xóa cùng Workout History.
  history: (range?: { fromDate: string; toDate: string }) => apiFetch<CheckinDto[]>(
    range ? `/check-in/history?fromDate=${range.fromDate}&toDate=${range.toDate}` : '/check-in/history', { cache: 'no-store' }),
};
