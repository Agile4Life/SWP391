import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maskCitizenId, receptionApi } from './receptionApi';

describe('receptionApi.ts (Receptionist Member Lookup & POS Billing)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('BR-05: maskCitizenId masks the middle digits of citizen ID', () => {
    expect(maskCitizenId('079198001234')).toBe('079******234');
    expect(maskCitizenId('123456789')).toBe('123******789');
    expect(maskCitizenId(null)).toBe('Chưa cập nhật');
    expect(maskCitizenId('')).toBe('Chưa cập nhật');
  });

  it('lookupMembers calls /api/v1/members/lookup with query', async () => {
    const mockMembers = [
      {
        userId: 1,
        membershipCode: 'MB-2026-001',
        fullName: 'Nguyễn Văn An',
        email: 'an@fit.com',
        phone: '0901234567',
        status: 'ACTIVE',
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockMembers }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await receptionApi.lookupMembers('0901234567');
    expect(result).toEqual(mockMembers);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/members/lookup?q=0901234567',
      expect.anything()
    );
  });

  it('lookupMembers returns empty array if query length < 2', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await receptionApi.lookupMembers('a');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('BR-02: getActivePackages only returns packages with status === active', async () => {
    const mockPackages = [
      { id: 1, name: 'The Essential', price: 2800000, durationDays: 30, status: 'active' },
      { id: 2, name: 'The Sanctuary', price: 7500000, durationDays: 90, status: 'inactive' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockPackages }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const activeList = await receptionApi.getActivePackages();
    expect(activeList).toHaveLength(1);
    expect(activeList[0].id).toBe(1);
    expect(activeList[0].status).toBe('active');
  });

  it('processPayment calls payment endpoint and returns invoiceNumber', async () => {
    const mockPayment = {
      id: 101,
      memberId: 1,
      amount: 2800000,
      method: 'pos',
      status: 'success',
      paidAt: '2026-10-07T21:00:00',
      invoiceNumber: 'INV-20261007-0101',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: mockPayment }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await receptionApi.processPayment({
      memberId: 1,
      packageId: 1,
      amount: 2800000,
      method: 'pos',
      notes: 'Thanh toán tại quầy',
    });

    expect(res.invoiceNumber).toBe('INV-20261007-0101');
    expect(res.status).toBe('success');
  });
});
