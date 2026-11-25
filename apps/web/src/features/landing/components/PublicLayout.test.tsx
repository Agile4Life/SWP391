import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
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
});
