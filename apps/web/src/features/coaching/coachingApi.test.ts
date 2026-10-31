import { afterEach, describe, expect, it, vi } from 'vitest';
import { coachingApi } from './coachingApi';

describe('coachingApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the numeric profile ID and preserves an empty schedule', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { userId: 42 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] })));
    vi.stubGlobal('fetch', fetchMock);

    expect(await coachingApi.getCoachWeeklySchedule('2026-10-19')).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/classes/sessions?coachId=42&fromDate=2026-10-19&toDate=2026-10-25');
  });

  it('preserves an empty student list and propagates failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Không thể tải' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await coachingApi.getSessionStudents(3)).toEqual([]);
    await expect(coachingApi.getSessionStudents(3)).rejects.toThrow('Không thể tải');
  });
});
