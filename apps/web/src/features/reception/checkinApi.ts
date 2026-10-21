import { apiFetch } from '../../shared/api/client';

export interface CheckinDto {
  id: number;
<<<<<<< Updated upstream
  memberId?: number | null;
  memberName?: string | null;
=======
  memberId: number | null;
  memberCode?: string | null;
  memberName?: string | null;
  avatarUrl?: string | null;
  packageName?: string | null;
  remainingDays?: number | null;
>>>>>>> Stashed changes
  checkInTime: string;
  checkOutTime?: string | null;
  method: string;
  gate?: string | null;
<<<<<<< Updated upstream
  status: 'GRANTED' | 'DENIED' | 'success' | 'denied' | string;
  denialReason?: string | null;
}

export interface ScanCheckinPayload {
=======
  status: 'GRANTED' | 'DENIED';
  denialReason?: string | null;
}

export interface ScanPayload {
>>>>>>> Stashed changes
  qrCode: string;
  gate?: string;
}

<<<<<<< Updated upstream
export interface CheckinHistoryFilter {
  memberId?: number;
  fromDate?: string;
  toDate?: string;
=======
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
>>>>>>> Stashed changes
}

export const checkinApi = {
  /**
<<<<<<< Updated upstream
   * Quét mã QR hội viên tại cổng/lễ tân (POST /api/v1/check-in/scan)
   */
  scan: async (payload: ScanCheckinPayload): Promise<CheckinDto> => {
    return apiFetch<CheckinDto>('/check-in/scan', {
      method: 'POST',
      body: JSON.stringify({
        qrCode: payload.qrCode.trim(),
        gate: payload.gate?.trim() || 'Turnstile A1 - Sảnh Chính',
=======
   * Gọi POST /check-in/scan để xác thực lượt check-in ra vào cổng
   * Phản hồi trả về kết quả quyết định từ BE (GRANTED hoặc DENIED)
   */
  scan: async (qrCode: string, gate: string = 'Turnstile A1 - Sảnh Chính'): Promise<CheckinDto> => {
    const validation = validateQrFormat(qrCode);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return await apiFetch<CheckinDto>('/check-in/scan', {
      method: 'POST',
      body: JSON.stringify({
        qrCode: qrCode.trim(),
        gate,
>>>>>>> Stashed changes
      }),
    });
  },

  /**
<<<<<<< Updated upstream
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

=======
   * Lấy danh sách lịch sử ra vào trong ngày (tối đa tất cả, FE lấy 10 lượt gần nhất)
   */
  getHistory: async (): Promise<CheckinDto[]> => {
    try {
      const data = await apiFetch<CheckinDto[]>('/check-in/history');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * Checkout ra khỏi trung tâm
   */
  checkout: async (id: number): Promise<CheckinDto> => {
    return await apiFetch<CheckinDto>(`/check-in/${id}/checkout`, {
      method: 'POST',
    });
  },
};
>>>>>>> Stashed changes
