import { apiFetch } from '../../shared/api/client';

export interface CheckinDto {
  id: number;
  memberId?: number | null;
  memberCode?: string | null;
  memberName?: string | null;
  avatarUrl?: string | null;
  packageName?: string | null;
  remainingDays?: number | null;
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

export interface ScanPayload {
  qrCode: string;
  gate?: string;
}

export interface CheckinHistoryFilter {
  memberId?: number;
  fromDate?: string;
  toDate?: string;
}

export interface QrValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * BR-03: Kiểm tra định dạng chuỗi mã QR ở Frontend.
 * Chuỗi rỗng hoặc sai định dạng (chứa khoảng trắng, ký tự không hợp lệ, quá ngắn < 3 ký tự) bị chặn ở FE.
 * Mã hợp lệ về cú pháp nhưng không tồn tại trong hệ thống VẪN ĐƯỢC PHÉP gửi tới BE để ghi nhận DENIED.
 */
export function validateQrFormat(rawQr: string): QrValidationResult {
  if (!rawQr || !rawQr.trim()) {
    return { valid: false, error: 'Vui lòng nhập hoặc quét chuỗi mã QR.' };
  }
  const clean = rawQr.trim();
  if (clean.length < 3) {
    return { valid: false, error: 'Mã QR quá ngắn (tối thiểu 3 ký tự).' };
  }
  // Cho phép chữ cái, chữ số, gạch ngang, gạch dưới, hai chấm (chuẩn chuỗi QR / UUID / thẻ)
  const qrRegex = /^[A-Za-z0-9_\-.:]{3,100}$/;
  if (!qrRegex.test(clean)) {
    return {
      valid: false,
      error: 'Mã QR không đúng định dạng (chỉ chấp nhận ký tự chữ, số, gạch nối, không chứa khoảng trắng).',
    };
  }
  return { valid: true };
}

export const checkinApi = {
  /**
   * Quét mã QR hội viên tại cổng/lễ tân (POST /api/v1/check-in/scan)
   * Hỗ trợ cả 2 cách gọi: scan({ qrCode, gate }) và scan(qrCode, gate)
   */
  scan: async (
    payloadOrQr: ScanCheckinPayload | string,
    gate?: string
  ): Promise<CheckinDto> => {
    let qr = '';
    let g = 'Turnstile A1 - Sảnh Chính';
    if (typeof payloadOrQr === 'string') {
      qr = payloadOrQr;
      if (gate) g = gate;
    } else {
      qr = payloadOrQr.qrCode;
      if (payloadOrQr.gate) g = payloadOrQr.gate;
    }

    const validation = validateQrFormat(qr);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return apiFetch<CheckinDto>('/check-in/scan', {
      method: 'POST',
      body: JSON.stringify({
        qrCode: qr.trim(),
        gate: g.trim(),
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
    try {
      const list = await apiFetch<CheckinDto[]>(`/check-in/history${qs}`);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },
};
