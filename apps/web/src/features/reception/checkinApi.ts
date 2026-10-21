import { apiFetch } from '../../shared/api/client';

export interface CheckinDto {
  id: number;
  memberId?: number | null;
  memberName?: string | null;
  checkInTime: string;
  checkOutTime?: string | null;
  method: string;
  gate?: string | null;
  status: 'GRANTED' | 'DENIED' | 'success' | 'denied' | string;
  denialReason?: string | null;
}

export interface ScanCheckinPayload {
  qrCode: string;
  gate?: string;
}

export interface CheckinHistoryFilter {
  memberId?: number;
  fromDate?: string;
  toDate?: string;
}

export const checkinApi = {
  /**
   * Quét mã QR hội viên tại cổng/lễ tân (POST /api/v1/check-in/scan)
   */
  scan: async (payload: ScanCheckinPayload): Promise<CheckinDto> => {
    return apiFetch<CheckinDto>('/check-in/scan', {
      method: 'POST',
      body: JSON.stringify({
        qrCode: payload.qrCode.trim(),
        gate: payload.gate?.trim() || 'Turnstile A1 - Sảnh Chính',
      }),
    });
  },

  /**
   * Ghi nhận hội viên ra về / checkout (POST /api/v1/check-in/{id}/checkout)
   */
  checkout: async (checkinId: number): Promise<CheckinDto> => {
    return apiFetch<CheckinDto>(`/check-in/${checkinId}/checkout`, {
      method: 'POST',
    });
  },

  /**
   * Lấy toàn bộ lịch sử hôm nay; UI tự giới hạn nhật ký, giữ đủ các lượt chưa checkout.
   */
  getHistory: async (filter?: CheckinHistoryFilter): Promise<CheckinDto[]> => {
    const params = new URLSearchParams();
    if (filter?.memberId) params.set('memberId', String(filter.memberId));
    if (filter?.fromDate) params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params.set('toDate', filter.toDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const list = await apiFetch<CheckinDto[]>(`/check-in/history${qs}`);
    return Array.isArray(list) ? list : [];
  },
};

