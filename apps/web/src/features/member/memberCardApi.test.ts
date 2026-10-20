import { expect, it, vi } from 'vitest';
import { getMembershipHistory, getMySubscription, getDynamicQr } from './memberCardApi';

it('reads one subscription from the API response data', async () => {
  const subscription = { id: 1, packageName: 'SÖL', status: 'active', qrCode: 'server-code' };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: subscription }) });
  vi.stubGlobal('fetch', fetchMock);
  expect(await getMySubscription()).toEqual(subscription);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/memberships/subscriptions/my', expect.anything());
  vi.unstubAllGlobals();
});

it('reads subscription history from the backend response data', async () => {
  const history = [{ id: 2, status: 'expired', endDate: '2026-10-01' }];
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: history }) });
  vi.stubGlobal('fetch', fetchMock);
  try {
    expect(await getMembershipHistory()).toEqual(history);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/memberships/subscriptions/history', expect.anything());
  } finally {
    vi.unstubAllGlobals();
  }
});

it('fetches dynamic QR from API response data', async () => {
  const dynamicQr = { qrCode: 'DYN:1:1:12345:abc', expiresInSeconds: 60, generatedAt: '2026-10-21T02:00:00Z' };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: dynamicQr }) });
  vi.stubGlobal('fetch', fetchMock);
  try {
    expect(await getDynamicQr()).toEqual(dynamicQr);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/memberships/subscriptions/my/dynamic-qr', expect.anything());
  } finally {
    vi.unstubAllGlobals();
  }
});
