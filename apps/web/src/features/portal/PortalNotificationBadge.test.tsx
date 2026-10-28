import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { PortalShell } from './PortalShell';
import { getUnreadCount } from '../member/notificationsApi';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';

vi.mock('../member/notificationsApi', () => ({ getUnreadCount: vi.fn() }));

it('keeps the newest unread badge after overlapping focus refreshes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Member', role: 'MEMBER' }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let finish!: (count: number) => void;
  vi.mocked(getUnreadCount).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue(0);
  try {
    await act(async () => root.render(<MemoryRouter><PortalShell /></MemoryRouter>));
    await act(async () => window.dispatchEvent(new Event('focus')));
    await act(async () => finish(5));
    expect(host.querySelector('.member-notification-bell')?.getAttribute('aria-label')).toBe('Thông báo · 0 chưa đọc');
    expect(host.querySelector('.member-notification-badge')).toBeNull();
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(getUnreadCount).toHaveBeenCalledTimes(3);
  } finally {
    await act(async () => root.unmount());
    host.remove(); localStorage.clear(); vi.resetAllMocks(); vi.unstubAllGlobals();
  }
});
