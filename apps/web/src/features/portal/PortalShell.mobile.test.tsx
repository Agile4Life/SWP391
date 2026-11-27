import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, TOKEN_STORAGE_KEY, type UserSession } from '../../shared/api/client';
import { PortalShell } from './PortalShell';
import { MemberNotificationsPage } from '../member/MemberNotificationsPage';

vi.mock('../member/notificationsApi', () => ({ getUnreadCount: vi.fn().mockResolvedValue(0), getNotifications: vi.fn().mockResolvedValue({ content: [], number: 0, totalPages: 1 }) }));

const BACKEND_ROLE: Record<UserSession['role'], string> = {
  MEMBER: 'MEMBER',
  STAFF: 'RECEPTIONIST',
  COACH: 'COACH',
  MANAGER: 'CENTER_MANAGER',
  ADMIN: 'ADMIN',
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}');
    if (url.includes('/auth/me')) {
      return new Response(JSON.stringify({
        success: true,
        data: { username: stored.identifier ?? 'an', role: BACKEND_ROLE[stored.role as UserSession['role']] ?? 'MEMBER', fullName: stored.name ?? 'Nguyễn An' },
      }));
    }
    if (url.includes('/wallet/my')) {
      return new Response(JSON.stringify({ success: true, data: { balance: 0, transactions: [] } }));
    }
    return new Response(JSON.stringify({ success: true, data: {} }));
  }));
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

// Dựng component vào DOM giả để kiểm thử.
async function renderPortal(role: UserSession['role'], path: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token');
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Nguyễn An', identifier: 'an', role }));
  const router = createMemoryRouter([
    { element: <PortalShell />, children: [{ path: '/member/notifications', element: <MemberNotificationsPage /> }, { path: '*', element: <h1>Nội dung portal</h1> }] },
    { path: '/login', element: <h1>Đăng nhập</h1> },
  ], { initialEntries: [path] });
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}

describe('mobile portal navigation', () => {
  it('keeps only reception and check-in tabs and removes checkout from the complete staff menu', async () => {
    await renderPortal('STAFF', '/staff/check-in');
    const tabs = host.querySelector('.portal-section-tabs')!;
    expect([...tabs.querySelectorAll('a')].map(link => link.getAttribute('href')))
      .toEqual(['/staff/reception', '/staff/check-in']);
    expect(host.querySelector('a[href="/staff/check-out"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]')!.click());
    expect(host.querySelector('dialog')).not.toBeNull();
    expect(host.querySelector('dialog a[href="/staff/check-out"]')).toBeNull();
  });

  it('opens legacy notification URLs as a panel over the dashboard', async () => {
    const router = await renderPortal('MEMBER', '/member/notifications');
    expect(router.state.location.pathname).toBe('/member/dashboard');
    const popover = host.querySelector<HTMLElement>('.notification-popover');
    expect(popover).not.toBeNull();
    // Neo theo nút chuông ngay cả khi mở từ URL chuyển hướng (không có click triggerRef trước đó).
    expect(popover?.style.right).toBe('auto');
    expect(popover?.style.top).not.toBe('');
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

  it('keeps notifications out of the rail and closes the topbar panel on outside pointerdown without pulling focus back to the bell', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    expect(host.querySelector('.portal-rail-nav [aria-label="Thông báo"]')).toBeNull();
    const trigger = host.querySelector<HTMLButtonElement>('button.member-notification-bell');
    expect(trigger).not.toBeNull();
    await act(async () => trigger!.click());
    expect(host.querySelector('.notification-popover')).not.toBeNull();
    expect(router.state.location.pathname).toBe('/member/dashboard');
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.notification-popover')).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it.each([
    ['MEMBER', '/member/dashboard', ['/member/dashboard', '/member/classes', '/member/check-in']],
    ['STAFF', '/staff/reception', ['/staff/reception', '/staff/check-in', '/staff/requests']],
    ['COACH', '/coach/pt-attendance', ['/coach/pt-attendance', '/coach/classes', '/coach/training-plans']],
    ['MANAGER', '/manager/reports', ['/manager/reports', '/manager/classes', '/manager/coach-assignments']],
    ['ADMIN', '/admin/users', ['/admin/users', '/admin/audit-logs', '/admin/payments']],
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
    expect(host.querySelector('.portal-rail-link.active')?.getAttribute('aria-label')).toBe('Thẻ & check-in');
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

  it('hides floating chat widget for STAFF and exposes /messages in the sidebar', async () => {
    const router = await renderPortal('STAFF', '/staff/dashboard');
    expect(host.querySelector('.chat-widget')).toBeNull();
    expect(host.querySelector('.app-sidebar a[href="/messages"]')).not.toBeNull();
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

  it('closes search, menu, and wallet shell dialogs when location.pathname changes', async () => {
    const router = await renderPortal('MEMBER', '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('button.portal-search-trigger')!.click());
    expect(host.querySelector('dialog')).not.toBeNull();
    await act(async () => router.navigate('/member/classes'));
    expect(host.querySelector('dialog')).toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="portal-avatar-trigger"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="avatar-menu-wallet"]')!.click());
    expect(host.querySelector('dialog')?.textContent).toContain('Ví điện tử SÖL');
    await act(async () => router.navigate('/member/invoices'));
    expect(host.querySelector('dialog')).toBeNull();
  });

  it('returns focus to the topbar menu button rather than bottom nav More when opened from topbar', async () => {
    await renderPortal('MEMBER', '/member/dashboard');
    const topbarMenu = host.querySelector<HTMLButtonElement>('button.portal-mobile-menu')!;
    await act(async () => topbarMenu.click());
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog).not.toBeNull();
    await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(topbarMenu);
  });

  it('keeps two front-desk tabs after retiring manual checkout', async () => {
    await renderPortal('STAFF', '/staff/reception');
    const tabs = host.querySelector<HTMLElement>('.portal-section-tabs');
    expect(tabs?.getAttribute('data-tab-count')).toBe('2');
    expect(tabs?.querySelectorAll('.portal-section-tab')).toHaveLength(2);
    expect(tabs?.querySelector('a[href="/staff/reception-history"]')).toBeNull();
  });

  it('opens the dedicated history screen from the mobile menu and marks only its sidebar item active', async () => {
    const router = await renderPortal('STAFF', '/staff/reception');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Thêm màn hình"]')!.click());
    const history = host.querySelector<HTMLAnchorElement>('dialog a[href="/staff/reception-history"]')!;
    expect(history).not.toBeNull();
    await act(async () => history.click());
    expect(router.state.location.pathname).toBe('/staff/reception-history');
    expect(host.querySelector('.portal-rail-link[href="/staff/reception-history"]')?.getAttribute('aria-current')).toBe('page');
    expect(host.querySelector('.portal-rail-link[href="/staff/reception"]')?.getAttribute('aria-current')).toBeNull();
    expect(host.querySelector('.portal-rail-link[href="/staff/reception-history"]')?.getAttribute('title')).toBe('Lịch sử');
  });

  it('sets busy on wallet modal during topup, shows error if paymentUrl is missing, and shows walletError + Retry on /wallet/my failure', async () => {
    let walletFails = true;
    let resolveTopup!: (res: Response) => void;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: { username: 'an', role: 'MEMBER', fullName: 'Nguyễn An' } })));
      }
      if (url.includes('/wallet/my')) {
        if (walletFails) {
          return Promise.resolve(new Response(JSON.stringify({ success: false, message: 'Lỗi kết nối ví' }), { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: { balance: 350000, transactions: [] } })));
      }
      if (url.includes('/wallet/topup/vnpay')) {
        return new Promise<Response>((resolve) => { resolveTopup = resolve; });
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: {} })));
    }));

    await renderPortal('MEMBER', '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="portal-avatar-trigger"]')!.click());
    // Không hiện giả 0 đ khi /wallet/my lỗi
    expect(host.querySelector('[data-testid="avatar-menu-wallet"]')?.textContent).toContain('Lỗi tải số dư');

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="avatar-menu-wallet"]')!.click());
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Lỗi kết nối ví');
    expect(dialog.textContent).not.toContain('Chưa có biến động số dư nào trong ví.');

    // Bấm Thử lại để tải lại ví thành công
    walletFails = false;
    const retryBtn = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Thử lại')!;
    expect(retryBtn).toBeDefined();
    await act(async () => retryBtn.click());
    expect(dialog.textContent).toContain('350.000');

    // Gọi nạp ví: Modal phải có aria-busy="true" và không đóng khi đang bận; nếu paymentUrl rỗng thì báo lỗi rõ ràng
    const topupBtn = dialog.querySelector<HTMLButtonElement>('[data-testid="wallet-topup-btn"]')!;
    await act(async () => { topupBtn.click(); });
    expect(dialog.getAttribute('aria-busy')).toBe('true');
    await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(host.querySelector('dialog')).not.toBeNull();

    await act(async () => {
      resolveTopup(new Response(JSON.stringify({ success: true, data: { reference: 'REF1', paymentUrl: '' } })));
    });
    expect(dialog.getAttribute('aria-busy')).toBe('false');
    expect(dialog.querySelector('.form-error')?.textContent).toContain('Không nhận được đường dẫn thanh toán VNPay');
  });

  it.each(['STAFF', 'COACH', 'MANAGER', 'ADMIN'] as const)('does not call GET /wallet/my for non-member role %s', async (role) => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return new Response(JSON.stringify({ success: true, data: { username: 'an', role: BACKEND_ROLE[role], fullName: 'Nguyễn An' } }));
      }
      return new Response(JSON.stringify({ success: true, data: {} }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    await renderPortal(role, '/member/dashboard');
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="portal-avatar-trigger"]')!.click());
    const walletCalls = fetchSpy.mock.calls.filter(([input]) => String(input).includes('/wallet/my'));
    expect(walletCalls).toHaveLength(0);
  });
});
