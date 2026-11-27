import { apiFetch } from '../../shared/api/client';

/**
 * Một lượt check-in: hội viên, giờ vào/ra, phương thức, cổng, trạng thái, lý do từ chối, ảnh, gói và số ngày
 * còn lại.
 */
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
  avatarUrl?: string | null;
  packageName?: string | null;
  remainingDays?: number | null;
}

/** Dữ liệu quét thẻ: mã QR và cổng (tùy chọn). */
export interface ScanCheckinPayload {
  qrCode: string;
  gate?: string;
}

/** QR cổng: mã, cổng, thời điểm tạo/hết hạn và số giây còn hiệu lực. */
export interface GateQrDto {
  qrCode: string;
  gateId: string;
  gate: string;
  generatedAt: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/** Bộ lọc lịch sử check-in: hội viên và khoảng ngày. */
export interface CheckinHistoryFilter {
  memberId?: number;
  fromDate?: string;
  toDate?: string;
}

/** Gom các hàm API check-in. */
export const checkinApi = {
  // Lấy mã QR hiện tại của một cổng.
  gateQr: (gateId: string, signal?: AbortSignal) => apiFetch<GateQrDto>(`/check-in/gate-qr?gate=${encodeURIComponent(gateId)}`, { cache: 'no-store', signal }),
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
   * Lấy toàn bộ lịch sử hôm nay; UI tự giới hạn nhật ký hiển thị.
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

