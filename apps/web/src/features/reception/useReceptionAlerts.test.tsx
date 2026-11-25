import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { getNotifications, markNotificationRead } from '../member/notificationsApi';
import { toast } from '../../shared/ui/toast';
import { useReceptionAlerts } from './useReceptionAlerts';
vi.mock('../member/notificationsApi', async original => ({ ...await original<typeof import('../member/notificationsApi')>(), getNotifications: vi.fn(), markNotificationRead: vi.fn() }));
vi.mock('../../shared/ui/toast', () => ({ toast: vi.fn() }));
function Probe({ role }: { role: string }) { useReceptionAlerts(role, 'desk'); return null; }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('polls new server requests once without reading or approving them', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers();
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const old = { id: 1, title: 'KYC', message: '', type: 'system', relatedEntityType: null, relatedEntityId: 10, isRead: false, createdAt: '', actionPath: '/staff/kyc' };
  vi.mocked(getNotifications).mockResolvedValue({ content: [old], number: 0, totalPages: 1 });
  await act(async () => root.render(<Probe role="STAFF" />));
  expect(toast).not.toHaveBeenCalled();
  vi.mocked(getNotifications).mockResolvedValue({ content: [{ ...old, id: 2 }, old], number: 0, totalPages: 1 });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(toast).toHaveBeenCalledTimes(1); expect(markNotificationRead).not.toHaveBeenCalled();
  await act(async () => root.unmount()); host.remove();
});
it('does not poll for members or managers', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); const root = createRoot(host);
  await act(async () => root.render(<Probe role="MEMBER" />));
  expect(getNotifications).not.toHaveBeenCalled(); await act(async () => root.unmount());
});
