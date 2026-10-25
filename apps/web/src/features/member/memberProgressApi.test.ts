import { afterEach, expect, it, vi } from 'vitest';
import { getMyProgressMetrics, getMyTrainingPlans, getMyCompletedItemIds, setTrainingItemCompleted } from './memberProgressApi';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('reads only authenticated member endpoints and unwraps real API data', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('fitcenter_token', 'test-token');
  expect(await getMyProgressMetrics()).toEqual([]);
  expect(await getMyTrainingPlans()).toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/health/metrics/my', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/coaching/training-plans/my', expect.anything());
  await getMyCompletedItemIds('2026-10-26');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/coaching/training-completions/my?exerciseDate=2026-10-26', expect.anything());
  await setTrainingItemCompleted(5, '2026-10-26', true);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/coaching/training-completions/my/5?exerciseDate=2026-10-26', expect.objectContaining({ method: 'PUT' }));
  await setTrainingItemCompleted(5, '2026-10-26', false);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/coaching/training-completions/my/5?exerciseDate=2026-10-26', expect.objectContaining({ method: 'DELETE' }));
});
