import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maskCitizenId, receptionApi } from './receptionApi';

describe('receptionApi.ts (Receptionist Member Lookup & POS Billing)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('BR-05: maskCitizenId masks the middle digits of the identity card number', () => {
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
      // Giả lập phần thân JSON của phản hồi API.
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

  it('returns an empty list only when the lookup API succeeds without matches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal('fetch', mockFetch);
    expect(await receptionApi.lookupMembers('missing')).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([403, 500])('propagates lookup HTTP %s without requesting /users or inventing member codes', async (status) => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: false, message: 'Lookup failed' }) });
    vi.stubGlobal('fetch', mockFetch);
    await expect(receptionApi.lookupMembers('1234')).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/members/lookup?q=1234', expect.anything());
  });

  it('BR-02: getActivePackages only returns packages with status === active', async () => {
    const mockPackages = [
      { id: 1, name: 'The Essential', price: 2800000, durationDays: 30, status: 'active' },
      { id: 2, name: 'The Sanctuary', price: 7500000, durationDays: 90, status: 'inactive' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: mockPackages }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const activeList = await receptionApi.getActivePackages();
    expect(activeList).toHaveLength(1);
    expect(activeList[0].id).toBe(1);
    expect(activeList[0].status).toBe('active');
  });

  it('processPayment calls payment endpoint and returns invoiceNumber', async () => {
    // Dữ liệu mẫu dùng trong các ca kiểm thử.
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
      // Giả lập phần thân JSON của phản hồi API.
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

  it('P0-03: getUnpaidCourseEnrollments fetches /api/v1/classes/enrollments/unpaid', async () => {
    const mockItems = [
      {
        enrollmentId: 55,
        paymentId: 801,
        classId: 10,
        className: 'Yoga Flow Sáng',
        disciplineName: 'Yoga',
        startDate: '2026-12-01',
        endDate: '2026-12-29',
        memberId: 10,
        memberName: 'Nguyễn Văn An',
        memberPhone: '0901234567',
        membershipCode: 'MB-010',
        amount: 200000,
        method: 'cash',
        createdAt: '2026-11-25T10:00:00',
      },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockItems }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await receptionApi.getUnpaidCourseEnrollments();
    expect(res).toEqual(mockItems);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/classes/enrollments/unpaid', expect.anything());
  });

  it('P0-03: confirmCourseEnrollmentPayment posts payment method to /api/v1/classes/enrollments/:id/confirm-payment', async () => {
    const settled = {
      id: 801,
      memberId: 10,
      memberName: 'Nguyễn Văn An',
      amount: 200000,
      method: 'bank_transfer',
      status: 'success',
      paidAt: '2026-11-25T12:00:00',
      invoiceNumber: 'INV-20261125-0801',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: settled }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await receptionApi.confirmCourseEnrollmentPayment(55, 'bank_transfer');
    expect(res).toEqual(settled);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/classes/enrollments/55/confirm-payment',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ method: 'bank_transfer' }),
      }),
    );
  });
});
