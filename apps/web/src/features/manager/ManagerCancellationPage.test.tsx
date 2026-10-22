import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerCancellationPage } from './ManagerCancellationPage';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../shared/api/client', () => ({ apiFetch: api.fetch }));

const pending = { id: 7, memberId: 10, memberName: 'Lan', subscriptionId: 100,
  packageName: 'Essential', reason: 'Chuyển nơi ở', status: 'PENDING',
  requestedAt: '2026-10-22T10:00:00', resolvedById: null, resolvedAt: null, resolutionNote: null };

describe('Manager cancellation review', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    api.fetch.mockReset();
    api.fetch.mockImplementation((path: string) => path === '/memberships/cancellations'
      ? Promise.resolve([pending]) : Promise.resolve({ ...pending, status: 'APPROVED' }));
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  const button = (host: HTMLElement, label: string) => [...host.querySelectorAll('button')]
    .find((item) => item.textContent?.trim() === label);

  it('requires confirmation before approving and refreshes the list', async () => {
    await act(async () => root.render(<ManagerCancellationPage />));
    expect(host.textContent).toContain('Lan');
    await act(async () => button(host, 'Duyệt hủy')?.click());
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('không hoàn tiền');
    await act(async () => button(host, 'Xác nhận quyết định')?.click());
    expect(api.fetch).toHaveBeenCalledWith('/memberships/cancellations/7/approve',
      expect.objectContaining({ method: 'POST' }));
    expect(api.fetch).toHaveBeenCalledTimes(3);
  });

  it('can reject without changing a subscription locally', async () => {
    await act(async () => root.render(<ManagerCancellationPage />));
    await act(async () => button(host, 'Từ chối')?.click());
    expect(api.fetch).toHaveBeenCalledTimes(1);
    await act(async () => button(host, 'Xác nhận quyết định')?.click());
    expect(api.fetch).toHaveBeenCalledWith('/memberships/cancellations/7/reject',
      expect.objectContaining({ method: 'POST' }));
  });

  it('shows load failure and offers retry', async () => {
    api.fetch.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(<ManagerCancellationPage />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('offline');
    await act(async () => button(host, 'Thử lại')?.click());
    expect(host.textContent).toContain('Lan');
  });
});
