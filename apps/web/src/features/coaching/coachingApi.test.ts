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
  it('P1-FE-53: loads assigned students (including pure PT 1:1) from /coaching/members with deduplication and null-safe defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: 9, memberCode: 'MB-009', fullName: 'PT Only Member', fitnessGoal: null, healthNotes: null, fitnessLevel: null },
            { id: 9, memberCode: 'MB-009', fullName: 'PT Only Member', fitnessGoal: 'Core', healthNotes: '', fitnessLevel: 'beginner' },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const students = await coachingApi.getAllAssignedStudents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/coaching/members');
    expect(students).toEqual([
      expect.objectContaining({
        id: 9,
        memberId: 9,
        membershipCode: 'MB-009',
        fullName: 'PT Only Member',
        fitnessGoal: 'Core',
        fitnessLevel: 'beginner',
        email: '',
      }),
    ]);
  });

  it('keeps assigned students empty and surfaces failed requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Unavailable' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await coachingApi.getAllAssignedStudents()).toEqual([]);
    await expect(coachingApi.getAllAssignedStudents()).rejects.toThrow('Unavailable');
  });

  it('P0-06: omits coachId query param when omitted or when a non-numeric username string is passed', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await coachingApi.getCoachSchedule();
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/classes/sessions', expect.anything());

    await coachingApi.getCoachSchedule('coach_marcus');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/classes/sessions', expect.anything());
  });

});
