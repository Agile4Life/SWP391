import { expect, it, vi } from 'vitest';
import { getMySubscription } from './memberCardApi';

it('reads one subscription from the API response data', async () => {
  const subscription = { id: 1, packageName: 'SÖL', status: 'active', qrCode: 'server-code' };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: subscription }) });
  vi.stubGlobal('fetch', fetchMock);
  expect(await getMySubscription()).toEqual(subscription);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/memberships/subscriptions/my', expect.anything());
  vi.unstubAllGlobals();
});
