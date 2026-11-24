import { afterEach, expect, it, vi } from 'vitest';
import { getCurrentMembership } from './memberDashboardApi';
afterEach(() => vi.unstubAllGlobals());
it('keeps the membership API unchanged', async () => {
  const membership = { id: 1, packageName: 'Gym' };
  const request = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: membership }) });
  vi.stubGlobal('fetch', request);
  await expect(getCurrentMembership()).resolves.toEqual(membership);
  expect(request).toHaveBeenCalledWith('/api/v1/memberships/subscriptions/my', expect.anything());
});
