import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicLayout } from './PublicLayout';
import { clearAuthSession, setCurrentUser } from '../../../shared/api/client';
import { setLanguage } from '../../../shared/i18n';

vi.mock('../../chat/chatRealtime', () => ({ subscribeChat: vi.fn(() => vi.fn()) }));
vi.mock('../../chat/chatApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../chat/chatApi')>()),
  getChatUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
}));

describe('PublicLayout session reactivity (P0-07)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLanguage('vi');
    clearAuthSession();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    clearAuthSession();
    host.remove();
    setLanguage('vi');
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('reactively updates header/footer CTAs and remounts ChatWidget on login and logout', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <PublicLayout>
            <main id="public-main">Landing</main>
          </PublicLayout>
        </MemoryRouter>,
      );
    });

    const headerCta = () => host.querySelector<HTMLAnchorElement>('.fit-header-cta');
    expect(headerCta()?.textContent).toContain('Đăng nhập');
    expect(headerCta()?.getAttribute('href')).toBe('/login');
    const guestTrigger = host.querySelector('.chat-widget__trigger');
    expect(guestTrigger).not.toBeNull();

    // Sign in -> header CTA switches to portal & ChatWidget remounts for the signed-in user
    await act(async () => {
      setCurrentUser({ id: 'member-1', identifier: 'member-1', name: 'Member 1', role: 'MEMBER' });
    });
    expect(headerCta()?.textContent).toContain('Vào portal');
    expect(headerCta()?.getAttribute('href')).toBe('/member/dashboard');
    const signedInTrigger = host.querySelector('.chat-widget__trigger');
    expect(signedInTrigger).not.toBeNull();
    expect(signedInTrigger).not.toBe(guestTrigger);

    // Sign out -> header CTA reverts to login & ChatWidget remounts cleanly as anonymous
    await act(async () => {
      clearAuthSession();
    });
    expect(headerCta()?.textContent).toContain('Đăng nhập');
    expect(headerCta()?.getAttribute('href')).toBe('/login');
    const afterLogoutTrigger = host.querySelector('.chat-widget__trigger');
    expect(afterLogoutTrigger).not.toBeNull();
    expect(afterLogoutTrigger).not.toBe(signedInTrigger);
  });

  it('closes mobile menu on Escape, outside click, and route change, respects reduced-motion scroll, keeps nav DOM identity on language switch, and renders role-aware footer link (P2-FE-05, P2-FE-12, P3-FE-03)', async () => {
    let navigateFn!: ReturnType<typeof useNavigate>;
    function NavDriver() {
      navigateFn = useNavigate();
      return <main id="public-main"><section id="about">About</section></main>;
    }
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener() {},
      removeEventListener() {},
    }));
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <PublicLayout>
            <NavDriver />
          </PublicLayout>
        </MemoryRouter>,
      );
    });

    // Localized VI document.title (P2-FE-05)
    expect(document.title).toContain('Xây dựng thể chất');

    // Stable nav DOM node across VI -> EN switch (P3-FE-03 key={to})
    const firstNavLink = host.querySelector<HTMLAnchorElement>('.fit-nav a[data-nav-target="about"]')!;
    await act(async () => setLanguage('en'));
    expect(host.querySelector('.fit-nav a[data-nav-target="about"]')).toBe(firstNavLink);
    expect(document.title).toContain('Build your body. Find your balance.');
    await act(async () => setLanguage('vi'));

    // Reduced-motion scrollIntoView uses behavior: 'auto' (P2-FE-12)
    await act(async () => firstNavLink.click());
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));

    // Mobile menu opens & closes on Escape (restoring focus to menu button)
    const menuBtn = host.querySelector<HTMLButtonElement>('.fit-menu')!;
    const nav = host.querySelector('#public-navigation')!;
    await act(async () => menuBtn.click());
    expect(nav.classList.contains('is-open')).toBe(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(nav.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(menuBtn);

    // Mobile menu closes on outside pointerdown
    await act(async () => menuBtn.click());
    expect(nav.classList.contains('is-open')).toBe(true);
    await act(async () => {
      host.querySelector('#public-main')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(nav.classList.contains('is-open')).toBe(false);

    // Mobile menu closes on route change
    await act(async () => menuBtn.click());
    expect(nav.classList.contains('is-open')).toBe(true);
    await act(async () => navigateFn('/sports/yoga'));
    expect(nav.classList.contains('is-open')).toBe(false);
    expect(host.querySelector('.fit-nav a[data-nav-target="multisport"]')?.classList.contains('is-active')).toBe(true);

    // Role-aware footer link (P3-FE-03)
    const footerLink = () => host.querySelector<HTMLAnchorElement>('.fit-footer-bottom a[href]')!;
    await act(async () => setCurrentUser({ id: 'mgr-1', identifier: 'mgr', name: 'Manager', role: 'MANAGER' }));
    expect(footerLink().textContent).toContain('Vào portal');
    expect(footerLink().textContent).not.toContain('Không gian hội viên');
    await act(async () => setCurrentUser({ id: 'mem-1', identifier: 'mem', name: 'Member', role: 'MEMBER' }));
    expect(footerLink().textContent).toContain('Không gian hội viên');
  });
});
