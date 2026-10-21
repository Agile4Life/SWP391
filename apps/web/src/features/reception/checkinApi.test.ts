import { beforeEach, describe, expect, it, vi } from 'vitest';
<<<<<<< Updated upstream
import { checkinApi } from './checkinApi';

describe('checkinApi.ts (Lobby QR Check-in & Checkout API Client)', () => {
=======
import { checkinApi, validateQrFormat, type CheckinDto } from './checkinApi';

describe('checkinApi.ts & QR validation (BR-01 to BR-05)', () => {
>>>>>>> Stashed changes
  beforeEach(() => {
    vi.restoreAllMocks();
  });

<<<<<<< Updated upstream
  it('scan posts qrCode and gate to /api/v1/check-in/scan', async () => {
    const mockCheckin = {
      id: 10,
      memberId: 2,
      memberName: 'Nguyễn Văn An',
      checkInTime: '2026-10-18T08:00:00',
      checkOutTime: null,
      method: 'qr_code',
      gate: 'Turnstile A1 - Sảnh Chính',
      status: 'success',
      denialReason: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: mockCheckin }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await checkinApi.scan({ qrCode: 'SUB-10-ABCD1234', gate: 'Turnstile A1 - Sảnh Chính' });
    expect(res).toEqual(mockCheckin);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/check-in/scan',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          qrCode: 'SUB-10-ABCD1234',
          gate: 'Turnstile A1 - Sảnh Chính',
        }),
      })
    );
  });

  it('checkout posts to /api/v1/check-in/{id}/checkout', async () => {
    const mockCheckedOut = {
      id: 10,
      memberId: 2,
      memberName: 'Nguyễn Văn An',
      checkInTime: '2026-10-18T08:00:00',
      checkOutTime: '2026-10-18T09:30:00',
      method: 'qr_code',
      gate: 'Turnstile A1 - Sảnh Chính',
      status: 'success',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockCheckedOut }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await checkinApi.checkout(10);
    expect(res.checkOutTime).toBe('2026-10-18T09:30:00');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/check-in/checkout' in ({} as Record<string, unknown>) ? '' : '/api/v1/check-in/10/checkout',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getHistory preserves all visits so pending checkout entries are not truncated', async () => {
    const items = Array.from({ length: 15 }, (_, idx) => ({
      id: idx + 1,
      memberId: 2,
      memberName: `Member ${idx + 1}`,
      checkInTime: '2026-10-18T08:00:00',
      method: 'qr_code',
      status: 'success',
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: items }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const history = await checkinApi.getHistory();
    expect(history).toHaveLength(15);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/check-in/history', expect.anything());
  });
});

=======
  describe('BR-03: validateQrFormat', () => {
    it('rejects empty or whitespace QR string', () => {
      expect(validateQrFormat('')).toEqual({
        valid: false,
        error: 'Vui lòng nhập hoặc quét chuỗi mã QR.',
      });
      expect(validateQrFormat('   ')).toEqual({
        valid: false,
        error: 'Vui lòng nhập hoặc quét chuỗi mã QR.',
      });
    });

    it('rejects QR string shorter than 3 characters', () => {
      expect(validateQrFormat('ab')).toEqual({
        valid: false,
        error: 'Mã QR quá ngắn (tối thiểu 3 ký tự).',
      });
    });

    it('rejects QR string with invalid characters like spaces or symbols', () => {
      const res = validateQrFormat('QR CODE 123');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('không đúng định dạng');
    });

    it('accepts valid QR format strings', () => {
      expect(validateQrFormat('QR-VALID-089').valid).toBe(true);
      expect(validateQrFormat('SOL-MB89-9831').valid).toBe(true);
      expect(validateQrFormat('a1b2-c3d4-e5f6').valid).toBe(true);
    });
  });

  describe('BR-02 & BR-03: checkinApi.scan', () => {
    it('throws validation error at FE before calling BE if format is invalid', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await expect(checkinApi.scan('')).rejects.toThrow('Vui lòng nhập hoặc quét chuỗi mã QR.');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls BE /api/v1/check-in/scan and returns GRANTED response', async () => {
      const mockGrantedDto: CheckinDto = {
        id: 101,
        memberId: 10,
        memberCode: 'MB-2026-089',
        memberName: 'Nguyễn Văn An',
        avatarUrl: 'https://example.com/avatar.jpg',
        packageName: 'The Sanctuary VIP',
        remainingDays: 25,
        checkInTime: '2026-10-15T08:00:00',
        checkOutTime: null,
        method: 'qr',
        gate: 'Turnstile A1 - Sảnh Chính',
        status: 'GRANTED',
        denialReason: null,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockGrantedDto }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await checkinApi.scan('QR-VALID-089');
      expect(result).toEqual(mockGrantedDto);
      expect(result.status).toBe('GRANTED');
      expect(result.remainingDays).toBe(25);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/check-in/scan',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ qrCode: 'QR-VALID-089', gate: 'Turnstile A1 - Sảnh Chính' }),
        })
      );
    });

    it('calls BE /api/v1/check-in/scan and receives DENIED response from BE', async () => {
      const mockDeniedDto: CheckinDto = {
        id: 102,
        memberId: null,
        memberCode: null,
        memberName: null,
        avatarUrl: null,
        packageName: null,
        remainingDays: null,
        checkInTime: '2026-10-15T08:05:00',
        checkOutTime: null,
        method: 'qr',
        gate: 'Turnstile A1 - Sảnh Chính',
        status: 'DENIED',
        denialReason: 'Mã QR không tồn tại hoặc không hợp lệ',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockDeniedDto }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await checkinApi.scan('QR-NON-EXISTENT-999');
      expect(result.status).toBe('DENIED');
      expect(result.denialReason).toBe('Mã QR không tồn tại hoặc không hợp lệ');
    });
  });

  describe('BR-05: checkinApi.getHistory', () => {
    it('calls /api/v1/check-in/history and returns list of checkins', async () => {
      const mockList: CheckinDto[] = [
        {
          id: 1,
          memberId: 10,
          memberName: 'Nguyễn Văn An',
          checkInTime: '2026-10-15T08:00:00',
          method: 'qr',
          gate: 'Turnstile A1',
          status: 'GRANTED',
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockList }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const history = await checkinApi.getHistory();
      expect(history).toEqual(mockList);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/check-in/history', expect.anything());
    });
  });
});
>>>>>>> Stashed changes
