import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../shared/api/client';
import { reconciliationApi } from './reconciliationApi';

vi.mock('../../shared/api/client', () => ({ apiFetch: vi.fn() }));

const page = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 };

describe('reconciliationApi', () => {
  afterEach(() => vi.resetAllMocks());

  it('builds query strings and skips empty or ALL filters', async () => {
    const fetch = vi.mocked(client.apiFetch).mockResolvedValue(page);
    await reconciliationApi.getAttempts({ status: 'ALL', stale: true, q: '  an@x.vn ', from: '2026-11-07', to: '2026-11-13', page: 2 });
    expect(fetch).toHaveBeenLastCalledWith('/admin/payments/reconciliation/attempts?stale=true&q=an%40x.vn&from=2026-11-07&to=2026-11-13&page=2&size=20');
    await reconciliationApi.getIpnEvents({ rspCode: '99', source: 'ALL', reference: '' });
    expect(fetch).toHaveBeenLastCalledWith('/admin/payments/reconciliation/ipn-events?rspCode=99&page=0&size=20');
    await reconciliationApi.getLateRefunds({ from: '2026-11-01' });
    expect(fetch).toHaveBeenLastCalledWith('/admin/payments/reconciliation/late-refunds?from=2026-11-01&page=0&size=20');
  });

  it('rejects malformed responses', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ unexpected: true });
    await expect(reconciliationApi.getSummary()).rejects.toThrow('Dữ liệu đối soát không hợp lệ.');
    await expect(reconciliationApi.getAttempts()).rejects.toThrow('Dữ liệu đối soát không hợp lệ.');
    await expect(reconciliationApi.getTimeline(1)).rejects.toThrow('Dữ liệu dòng thời gian không hợp lệ.');
  });
});
