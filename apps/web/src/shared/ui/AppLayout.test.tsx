import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY } from '../api/client';
import { AppLayout } from './AppLayout';

describe('portal navigation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      id: '1', name: 'Nguyễn An', identifier: 'an', role: 'MEMBER',
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

  async function renderPortal() {
    const router = createMemoryRouter([
      { element: <AppLayout />, children: [
        { path: '/member/dashboard', element: <h1>Tổng quan</h1> },
        { path: '/member/classes', element: <h1>Lịch học</h1> },
      ] },
      { path: '/login', element: <h1>Đăng nhập</h1> },
    ], { initialEntries: ['/member/dashboard'] });
    await act(async () => root.render(<RouterProvider router={router} />));
    return router;
  }

  it('finds an authorized screen using Vietnamese without accents and navigates', async () => {
    const router = await renderPortal();
    const search = host.querySelector<HTMLButtonElement>('button[aria-label="Tìm màn hình"]');
    expect(search).not.toBeNull();
    await act(async () => search!.click());
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'lich hoc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const links = host.querySelectorAll<HTMLAnchorElement>('dialog a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/member/classes');
    await act(async () => links[0].click());
    expect(router.state.location.pathname).toBe('/member/classes');
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement?.id).toBe('portal-main');
  });

  it('offers a labeled mobile menu with only member screens', async () => {
    await renderPortal();
    const menu = host.querySelector<HTMLButtonElement>('button[aria-label="Mở điều hướng"]');
    expect(menu).not.toBeNull();
    await act(async () => menu!.click());
    const dialog = host.querySelector('dialog')!;
    expect(dialog.querySelector('a[href="/member/card"]')).not.toBeNull();
    expect(dialog.querySelector('a[href^="/manager/"]')).toBeNull();
    expect(dialog.querySelector('a[href^="/staff/"]')).toBeNull();
  });

  it('keeps the session when logout confirmation is dismissed', async () => {
    await renderPortal();
    const logout = host.querySelector<HTMLButtonElement>('button[aria-label="Đăng xuất"]');
    expect(logout).not.toBeNull();
    await act(async () => logout!.click());
    const cancel = [...host.querySelectorAll('dialog button')].find((button) => button.textContent === 'Ở lại');
    expect(cancel).toBeDefined();
    await act(async () => (cancel as HTMLButtonElement).click());
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    expect(host.querySelector('dialog')).toBeNull();
  });
});
