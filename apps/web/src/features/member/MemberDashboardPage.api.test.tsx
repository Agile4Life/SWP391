import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { MemberDashboardPage } from './MemberDashboardPage';
import { getMySubscription } from './memberCardApi';
import { getCurrentMembership } from './membershipApi';

afterEach(() => vi.unstubAllGlobals());

it('renders a member without a subscription using the real API client and an omitted data field', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // ApiResponse uses NON_NULL: no current subscription omits data entirely.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true, status: 200, message: 'OK', timestamp: '2026-10-18T22:45:00',
      ...(url.includes('/enrollments/') ? { data: [] } : {}),
    }),
  })));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><MemberDashboardPage /></MemoryRouter>));
    expect(host.textContent).toContain('Chưa có gói tập đang hoạt động');
    expect(host.textContent).toContain('Bạn chưa có lớp học đang đặt.');
    expect(host.querySelector('a[href="/member/packages"]')).not.toBeNull();
    // The same transport fix must cover packages and member cards as well.
    await expect(getCurrentMembership()).resolves.toBeNull();
    await expect(getMySubscription()).resolves.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
