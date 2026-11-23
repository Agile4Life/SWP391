import { afterEach, expect, it, vi } from 'vitest';
import { getMyTrainingPlans } from './memberProgressApi';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('keeps the authenticated training plan endpoint and returns its real DTO data', async () => {
  const plan = { id: 1, status: 'active', startDate: '2026-01-01', endDate: '2099-12-31', goal: 'Gym', coachName: 'An', items: [] };
  const request = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [plan] }) });
  vi.stubGlobal('fetch', request); localStorage.setItem('fitcenter_token', 'member-token');
  await expect(getMyTrainingPlans()).resolves.toEqual([plan]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/api/v1/coaching/training-plans/my', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer member-token' }) }));
});
