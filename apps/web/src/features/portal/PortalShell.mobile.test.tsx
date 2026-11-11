import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, type UserSession } from '../../shared/api/client';
import { PortalShell } from './PortalShell';
import { MemberNotificationsPage } from '../member/MemberNotificationsPage';

vi.mock('../member/notificationsApi', () => ({ getUnreadCount: vi.fn().mockResolvedValue(0), getNotifications: vi.fn().mockResolvedValue({ content: [], number: 0, totalPages: 1 }) }));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderPortal(role: UserSession['role'], path: string) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Nguyễn An', identifier: 'an', role }));
  const router = createMemoryRouter([
    { element: <PortalShell />, children: [{ path: '/member/notifications', element: <MemberNotificationsPage /> }, { path: '*', element: <h1>Nội dung portal</h1> }] },
    { path: '/login', element: <h1>Đăng nhập</h1> },
  ], { initialEntries: [path] });
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}

describe('mobile portal navigation', () => {
  it('opens legacy notification URLs as a panel over the dashboard', async () => {
    const router = await renderPortal('MEMBER', '/member/notifications');
    expect(router.state.location.pathname).toBe('/member/dashboard');
    expect(host.querySelector('.notification-popover')).not.toBeNull();
  });

  it('opens notifications from More without navigating and closes its navigation modal', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]')!.click());
    const notifications = [...host.querySelectorAll<HTMLButtonElement>('.portal-screen-results button')].find(button => button.textContent === 'Thông báo');
    expect(notifications).toBeDefined();
    await act(async () => notifications!.click());
    expect(router.state.location.pathname).toBe('/member/dashboard');
    expect(host.querySelector('dialog')).toBeNull();
    expect(host.querySelector('.notification-popover')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Đóng thông báo');
  });

  it('opens notifications in a corner panel without navigating and restores focus on Escape', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    const bell = host.querySelector<HTMLButtonElement>('button.member-notification-bell');
    expect(bell).not.toBeNull();
    await act(async () => bell!.click());
    expect(router.state.location.pathname).toBe('/member/dashboard');
    expect(host.querySelector('[role="dialog"][aria-label="Thông báo"]')?.textContent).toContain('Chưa có thông báo');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.notification-popover')).toBeNull();
    expect(document.activeElement).toBe(bell);
  });

  it('keeps notifications out of the rail and closes the topbar panel on outside pointerdown', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    expect(host.querySelector('.portal-rail-nav [aria-label="Thông báo"]')).toBeNull();
    const trigger = host.querySelector<HTMLButtonElement>('button.member-notification-bell');
    expect(trigger).not.toBeNull();
    await act(async () => trigger!.click());
    expect(host.querySelector('.notification-popover')).not.toBeNull();
    expect(router.state.location.pathname).toBe('/member/dashboard');
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.notification-popover')).toBeNull();
  });

  it.each([
    ['MEMBER', '/member/dashboard', ['/member/dashboard', '/member/classes', '/member/check-in']],
    ['STAFF', '/staff/reception', ['/staff/reception', '/staff/classes', '/staff/check-in']],
    ['COACH', '/coach/classes', ['/coach/classes', '/staff/attendance', '/coach/training-plans']],
    ['MANAGER', '/manager/reports', ['/manager/reports', '/manager/catalogs', '/staff/classes']],
  ] as const)('shows only the three primary actions for %s and marks the current screen', async (role, path, expected) => {
    await renderPortal(role, path);
    const nav = host.querySelector('nav[aria-label="Điều hướng nhanh"]');
    expect(nav).not.toBeNull();
    expect([...nav!.querySelectorAll('a')].map(link => link.getAttribute('href'))).toEqual(expected);
    expect(nav!.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe(path);
    expect(nav!.querySelector('button[aria-label="Thêm màn hình"]')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the complete member menu, reaches the merged card entry and closes the menu', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    const more = host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]');
    expect(more).not.toBeNull();
    await act(async () => more!.click());
    expect(more!.getAttribute('aria-expanded')).toBe('true');
    const dialog = host.querySelector('dialog')!;
    expect(dialog.querySelector('a[href="/member/profile"]')).not.toBeNull();
    expect(dialog.querySelector('a[href^="/manager/"]')).toBeNull();
    // Mục gộp: Quét QR và Bảo lưu không còn là mục riêng trong menu.
    expect(dialog.querySelector('a[href="/member/check-in"]')).toBeNull();
    expect(dialog.querySelector('a[href="/member/hold"]')).toBeNull();
    const card = dialog.querySelector<HTMLAnchorElement>('a[href="/member/card"]');
    expect(card).not.toBeNull();
    await act(async () => card!.click());
    expect(router.state.location.pathname).toBe('/member/card');
    expect(host.querySelector('dialog')).toBeNull();
    const tabs = host.querySelector('.portal-section-tabs');
    expect(tabs?.textContent).toContain('Thẻ hội viên');
    await act(async () => tabs!.querySelector<HTMLAnchorElement>('a[href="/member/check-in"]')!.click());
    expect(router.state.location.pathname).toBe('/member/check-in');
    expect(host.querySelector('.portal-rail-link.active')?.getAttribute('aria-label')).toBe('Thẻ & Check-in');
  });

  it('finds a merged screen by the name of one of its tabs', async () => {
    await renderPortal('MEMBER', '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('button.portal-search-trigger')!.click());
    const input = host.querySelector<HTMLInputElement>('#portal-screen-search')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setValue.call(input, 'quét qr'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.querySelector('.portal-screen-results a[href="/member/card"]')).not.toBeNull();
  });

  it('marks More on secondary screens and keeps logout in the topbar avatar menu', async () => {
    const router = await renderPortal('STAFF', '/messages');
    const more = host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]');
    expect(more).not.toBeNull();
    expect(more!.getAttribute('aria-current')).toBe('true');
    await act(async () => more!.click());
    expect(host.querySelector('dialog button[aria-label="Đăng xuất"]')).toBeNull();
    await act(async () => host.querySelector<HTMLDialogElement>('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="portal-avatar-trigger"]')!.click());
    const logout = host.querySelector<HTMLButtonElement>('[data-testid="avatar-menu-logout"]');
    expect(logout).not.toBeNull();
    await act(async () => logout!.click());
    const confirm = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === 'Đăng xuất')!;
    await act(async () => confirm.click());
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('offers one floating messages button (SÖL AI lives inside it) and hides it during scanning', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    expect(host.querySelector('.chat-widget')).not.toBeNull();
    // Không còn nút AI tách riêng.
    expect(host.querySelector('.member-ai-chat')).toBeNull();
    expect(host.querySelector('.app-sidebar a[href="/messages"]')).toBeNull();
    await act(async () => router.navigate('/member/check-in'));
    expect(host.querySelector('.chat-widget')).toBeNull();
    expect(host.querySelector('.member-ai-chat')).toBeNull();
  });

  it('hides floating chat widget on /staff/check-in scanner route', async () => {
    const router = await renderPortal('STAFF', '/staff/dashboard');
    expect(host.querySelector('.chat-widget')).not.toBeNull();
    await act(async () => router.navigate('/staff/check-in'));
    expect(host.querySelector('.chat-widget')).toBeNull();
  });

  it('closes install help before closing its parent navigation menu', async () => {
    await renderPortal('MEMBER', '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.pwa-install-button')!.click());
    const dialogs = host.querySelectorAll('dialog');
    expect(dialogs).toHaveLength(2);
    await act(async () => dialogs[1].dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(host.querySelectorAll('dialog')).toHaveLength(1);
    expect(host.querySelector('dialog .portal-screen-results')).not.toBeNull();
  });
});
