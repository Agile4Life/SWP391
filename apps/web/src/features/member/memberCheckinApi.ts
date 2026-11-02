import { apiFetch } from '../../shared/api/client';
import type { CheckinDto } from '../reception/checkinApi';

export const memberCheckinApi = {
  scan: (gateQr: string) => apiFetch<CheckinDto>('/check-in/self', {
    method: 'POST', cache: 'no-store', body: JSON.stringify({ gateQr }),
  }),
  history: () => apiFetch<CheckinDto[]>('/check-in/history', { cache: 'no-store' }),
};
