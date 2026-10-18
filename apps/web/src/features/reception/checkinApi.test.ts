import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkinApi } from './checkinApi';

describe('checkinApi.ts (Lobby QR Check-in & Checkout API Client)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it('getHistory fetches from /api/v1/check-in/history and caps at 10 items', async () => {
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
    expect(history).toHaveLength(10);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/check-in/history', expect.anything());
  });
});

