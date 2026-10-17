import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBookedEnrollments, type BookedClass } from './memberDashboardApi';

describe('SCRUM-85 enrollment API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses the backend route and supported filters, and keeps the DTO fields', async () => {
    const enrollment: BookedClass = {
      id: 9, classId: 2, className: 'Yoga', coachName: 'An', roomName: 'A',
      sessionDate: '2026-10-17', startTime: '08:00:00', endTime: '09:00:00',
      status: 'booked', createdAt: '2026-10-16T10:00:00',
      cancelledAt: null, cancelReason: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [enrollment] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBookedEnrollments()).resolves.toEqual([enrollment]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classes/enrollments/my?status=booked&upcoming=true',
      expect.anything(),
    );
  });
});
