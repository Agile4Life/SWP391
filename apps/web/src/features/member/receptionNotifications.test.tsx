import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberNotificationsPanel } from './MemberNotificationsPage';
import { notificationDestination, safeNotificationPath, type MemberNotification } from './notificationsApi';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { clearNotices, getNotices, notify } from '../../shared/lib/portalNotices';

const api = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), read: vi.fn(), all: vi.fn() }));
vi.mock('./notificationsApi', async original => ({ ...(await original<typeof import('./notificationsApi')>()),
  getNotifications: api.list, getUnreadCount: api.count, markNotificationRead: api.read, markAllNotificationsRead: api.all }));
const item: MemberNotification = { id: 7, title: 'Thông báo', message: 'Nội dung', type: 'system', relatedEntityType: null,
  relatedEntityId: null, isRead: false, createdAt: '2026-11-23T10:00:00' };
const routes = ['/staff/reception', '/staff/check-in', '/staff/check-out', '/staff/reception-history', '/staff/kyc', '/staff/holds', '/staff/requests', '/messages?tab=support'];
let host: HTMLDivElement; let root: Root; let closed: ReturnType<typeof vi.fn<() => void>>;
// Component phụ chỉ phục vụ kiểm thử.
function Path() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); clearNotices(); vi.clearAllMocks();
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'staff', name: 'Lễ tân', identifier: 'staff', role: 'RECEPTIONIST' }));
  api.list.mockResolvedValue({ content: [item], number: 0, totalPages: 1 }); api.count.mockResolvedValue(1);
  api.read.mockResolvedValue(undefined); api.all.mockResolvedValue(undefined); closed = vi.fn<() => void>();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearNotices(); localStorage.clear(); vi.unstubAllGlobals(); });
// Dựng component vào DOM giả để kiểm thử.
const render = () => act(async () => root.render(<MemoryRouter initialEntries={['/staff/reception']}><MemberNotificationsPanel onNavigate={closed} /><Path /></MemoryRouter>));

it.each(routes)('opens only the existing Receptionist destination: %s', async actionPath => {
  api.list.mockResolvedValue({ content: [{ ...item, actionPath }], number: 0, totalPages: 1 });
  await render(); await act(async () => host.querySelector<HTMLButtonElement>('.notification-item')!.click());
  expect(api.read).toHaveBeenCalledWith(7); expect(closed).toHaveBeenCalledTimes(1);
  expect(host.querySelector('output')?.textContent).toBe(actionPath);
});

it.each(['STAFF', 'RECEPTIONIST'])('maps real payment metadata to transaction history for %s', role => {
  expect(notificationDestination({ ...item, type: 'payment', relatedEntityType: 'payment' }, role)).toBe('/staff/reception-history');
});

it.each(['Your request was approved', 'Your request was rejected', 'Đơn từ của bạn đã được duyệt', 'Đơn từ của bạn bị từ chối'])('maps a real internal-request title only when metadata is absent: %s', title => {
  expect(notificationDestination({ ...item, title }, 'STAFF')).toBe('/staff/requests');
  expect(notificationDestination({ ...item, title, relatedEntityType: 'support_request' }, 'STAFF')).toBe('/messages?tab=support');
});

it.each(['/staff/orders/42', '/staff/classes', '/staff/pt-attendance', '/staff/attendance/7'])('retired Staff links never open the removed page: %s', actionPath => {
  expect(notificationDestination({ ...item, actionPath }, 'STAFF')).toBe('/staff/reception');
});

it.each(['/manager/reports', '/admin/users', '/coach/classes', '/member/profile', '/staff/not-a-route', 'https://example.com', '//example.com', '/staff/../manager/reports', '/staff/kyc?returnTo=%2Fmanager%2Freports'])('rejects unsafe or unrelated destinations: %s', actionPath => {
  const target = notificationDestination({ ...item, actionPath }, 'STAFF');
  expect(routes).toContain(target); expect(safeNotificationPath(actionPath, 'STAFF')).not.toBe(actionPath);
});

it('does not guess a business destination from an id or free text', () => {
  const unknown = { ...item, title: 'Hoàn tiền', message: 'INV-123', relatedEntityId: 999 };
  expect(notificationDestination(unknown, 'STAFF')).toBe('/staff/reception');
});

it('keeps cancellation results at POS because the current history has no refund-request list', () => {
  expect(notificationDestination({ ...item, title: 'Cancellation request approved & refunded to Wallet', actionPath: '/staff/reception' }, 'STAFF')).toBe('/staff/reception');
});

it('keeps the unread notification and stays put if marking read fails, then allows retry', async () => {
  api.read.mockRejectedValueOnce(new Error('Không thể đánh dấu đã đọc'));
  api.list.mockResolvedValue({ content: [{ ...item, type: 'payment', relatedEntityType: 'payment' }], number: 0, totalPages: 1 });
  await render(); await act(async () => host.querySelector<HTMLButtonElement>('.notification-item')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể đánh dấu đã đọc');
  expect(host.querySelector('.notification-item--unread')).not.toBeNull(); expect(closed).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('.notification-item')!.click());
  expect(host.querySelector('output')?.textContent).toBe('/staff/reception-history'); expect(api.read).toHaveBeenCalledTimes(2);
});

it('sends one read request and navigates once even when clicks arrive in the same event batch', async () => {
  let finish!: () => void; api.read.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await render(); const button = host.querySelector<HTMLButtonElement>('.notification-item')!;
  await act(async () => { button.click(); button.click(); }); expect(api.read).toHaveBeenCalledTimes(1);
  expect(closed).not.toHaveBeenCalled(); await act(async () => finish()); expect(closed).toHaveBeenCalledTimes(1);
});

it('navigates once for an already-read item without sending another read request', async () => {
  api.list.mockResolvedValue({ content: [{ ...item, isRead: true }], number: 0, totalPages: 1 });
  await render(); const button = host.querySelector<HTMLButtonElement>('.notification-item')!;
  await act(async () => { button.click(); button.click(); });
  expect(api.read).not.toHaveBeenCalled(); expect(closed).toHaveBeenCalledTimes(1);
});

it('does not navigate twice when the same client activity is clicked in one batch', async () => {
  notify('Đã thu tiền', 'success', { record: true, destination: '/staff/reception-history' });
  await render(); const button = host.querySelector<HTMLButtonElement>('.notification-activity .notification-copy')!;
  await act(async () => { button.click(); button.click(); }); expect(closed).toHaveBeenCalledTimes(1);
});

it('prevents activity navigation while a server read request is pending', async () => {
  notify('Đã nạp ví', 'success', { record: true, destination: '/staff/reception-history' });
  let finish!: () => void; api.read.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('.notification-item')!.click());
  const activity = host.querySelector<HTMLButtonElement>('.notification-activity .notification-copy')!;
  expect(activity.disabled).toBe(true); await act(async () => activity.click()); expect(closed).not.toHaveBeenCalled();
  await act(async () => finish()); expect(closed).toHaveBeenCalledTimes(1);
});

it.each(['Đã xác nhận thu tiền. Hóa đơn: INV-7', 'Đã cộng tiền vào Ví SÖL'])('opens recorded financial activity by destination, not by its message: %s', async message => {
  notify(message, 'success', { record: true, destination: '/staff/reception-history' });
  await render(); await act(async () => host.querySelector<HTMLButtonElement>('.notification-activity .notification-copy')!.click());
  expect(host.querySelector('output')?.textContent).toBe('/staff/reception-history');
  expect(api.read).not.toHaveBeenCalled(); expect(getNotices()).toHaveLength(1); expect(getNotices()[0].read).toBe(true);
});
