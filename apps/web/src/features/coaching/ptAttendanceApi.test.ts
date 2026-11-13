import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPtAttendance, unmarkPtAttended } from './ptAttendanceApi';

describe('PT attendance HTTP client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the real unmark endpoint and returns backend data', async () => {
    const data = { id: 11, attendedAt: null, status: 'confirmed' };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data })));
    vi.stubGlobal('fetch', request);
    expect(await unmarkPtAttended(11)).toEqual(data);
    expect(request.mock.calls[0][0]).toBe('/api/v1/coach-bookings/11/unmark-attended');
    expect(request.mock.calls[0][1].method).toBe('POST');
  });

  it.each([403, 500])('propagates HTTP %s without fabricating success', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, message: 'Attendance rejected', code: 'TEST_ERROR',
    }), { status })));
    await expect(unmarkPtAttended(11)).rejects.toMatchObject({ status, message: 'Attendance rejected' });
  });

  it('sends the chosen dates and outcome on every fresh read', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] })));
    vi.stubGlobal('fetch', request);
    await getPtAttendance('2026-11-13', '2026-11-14', 'UPCOMING');
    expect(request.mock.calls[0][0]).toBe('/api/v1/coach-bookings/attendance?from=2026-11-13&to=2026-11-14&outcome=UPCOMING');
  });
});
