import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, AUTH_STORAGE_KEY, TOKEN_STORAGE_KEY } from '../api/client';
import { AppLayout } from '../ui/AppLayout';
import { PublicLayout } from '../../features/landing/components/PublicLayout';
import { getLanguage, LANGUAGE_STORAGE_KEY, setLanguage } from './index';
import { sourceText } from './sourceText';
import { englishLabels } from './translations';

describe('Multi-language settings (Avatar dropdown & Footer)', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('vi');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setLanguage('vi');
    document.body.innerHTML = '';
  });

  it('defaults to vi and sends dynamic Accept-Language header in apiFetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })
    );

    expect(getLanguage()).toBe('vi');
    await apiFetch('/profile');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/profile',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Accept-Language': 'vi' }),
      })
    );

    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    await apiFetch('/profile');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/profile',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Accept-Language': 'en' }),
      })
    );
  });

  it('switches language from the user avatar dropdown, with no switch in the portal workspace footer', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return new Response(JSON.stringify({ success: true, data: { username: 'member1', role: 'MEMBER', fullName: 'Nguyen Van A' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { balance: 0, transactions: [], content: [], number: 0, totalPages: 0 } }), { status: 200 });
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, 'member-token');
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: '1', name: 'Nguyen Van A', identifier: 'member1', role: 'MEMBER' })
    );

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <AppLayout />,
          children: [{ path: 'member/dashboard', element: <div>Bảng điều khiển</div> }],
        },
      ],
      { initialEntries: ['/member/dashboard'] }
    );

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    // Footer của portal chỉ hiển thị thương hiệu; cài đặt ngôn ngữ nằm trong menu ảnh đại diện
    expect(host.querySelector('[data-testid="footer-language-setting"]')).toBeNull();
    expect(host.querySelector('.portal-workspace-footer')?.textContent).toContain('SÖL Fitness');

    // Mở menu ảnh đại diện của người dùng
    const avatarTrigger = host.querySelector<HTMLButtonElement>('[data-testid="portal-avatar-trigger"]');
    expect(avatarTrigger).not.toBeNull();
    await act(async () => {
      avatarTrigger!.click();
    });

    const avatarSetting = host.querySelector('[data-testid="avatar-language-setting"]');
    expect(avatarSetting).not.toBeNull();
    expect(avatarSetting?.textContent).toContain('Cài đặt · Ngôn ngữ');

    const enAvatarBtn = host.querySelector<HTMLButtonElement>('[data-testid="avatar-lang-en"]');
    expect(enAvatarBtn).not.toBeNull();

    // Chuyển sang tiếng Anh qua menu cài đặt ở ảnh đại diện
    await act(async () => {
      enAvatarBtn!.click();
    });

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(host.querySelector('[data-testid="avatar-language-setting"]')?.textContent).toContain('Settings · Language');
    expect(host.querySelector('[data-testid="avatar-menu-wallet"]')?.textContent).toContain('My Wallet');
    expect(host.querySelector('[data-testid="avatar-menu-profile"]')?.textContent).toContain('Personal Profile');
    expect(host.querySelector('[data-testid="avatar-menu-logout"]')?.textContent).toContain('Sign out');
    expect(host.querySelector('.portal-workspace-footer')?.textContent).toContain('SÖL Fitness');

    // Chuyển lại tiếng Việt qua menu ảnh đại diện
    const viAvatarBtn = host.querySelector<HTMLButtonElement>('[data-testid="avatar-lang-vi"]');
    expect(viAvatarBtn).not.toBeNull();
    await act(async () => {
      viAvatarBtn!.click();
    });

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
    expect(host.querySelector('.portal-workspace-footer')?.textContent).toContain('SÖL Fitness');

    await act(async () => {
      root.unmount();
    });
  });

  it('switches language from the public footer in PublicLayout', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <PublicLayout>
              <main id="public-main">Nội dung trang chủ</main>
            </PublicLayout>
          ),
        },
      ],
      { initialEntries: ['/'] }
    );

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    const footerSetting = host.querySelector('.fit-footer [data-testid="footer-language-setting"]');
    expect(footerSetting).not.toBeNull();
    expect(host.querySelector('.fit-header')?.textContent).toContain('Về SÖL');

    const enFooterBtn = host.querySelector<HTMLButtonElement>('.fit-footer [data-testid="footer-lang-en"]');
    expect(enFooterBtn).not.toBeNull();

    await act(async () => {
      enFooterBtn!.click();
    });

    expect(getLanguage()).toBe('en');
    expect(host.querySelector('.fit-header')?.textContent).toContain('About SÖL');
    expect(host.querySelector('.fit-footer')?.textContent).toContain('06:00 — 22:00 daily');

    await act(async () => {
      root.unmount();
    });
  });

  // P2-FE-17: In-memory fallbackLanguage when localStorage throws SecurityError
  it('falls back to in-memory language state when localStorage throws SecurityError', () => {
    const secErr = new DOMException('Blocked', 'SecurityError');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw secErr; });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw secErr; });

    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    setLanguage('vi');
    expect(getLanguage()).toBe('vi');
  });

  // P2-FE-19: Natural English labels without grammar errors or Vietnamese weekday leaks
  it('renders corrected English labels for landing headings, services, schedule tags, and KYC copy', () => {
    setLanguage('en');
    expect(`${sourceText('Bạn nhận được')} ${sourceText('gì ')}${sourceText('khi có gói.')}`).toBe('Membership benefits included.');
    expect(sourceText('WeightLifting')).toBe('Weightlifting');
    expect(sourceText('Tập tạ')).toBe('Weightlifting');
    expect(`${sourceText('BUILD YOUR')} ${sourceText('BODY SHAPES')}`).toBe('BUILD YOUR STRENGTH & PHYSIQUE');
    expect(sourceText('T2 · Sức mạnh')).toBe('Mon · Strength');
    expect(sourceText('CN · Linh hoạt')).toBe('Sun · Mobility');
    expect(
      englishLabels['Hội viên mới cần cập nhật CCCD (hoặc Hộ chiếu cho người nước ngoài) để xác thực hợp đồng hội viên. Họ tên tài khoản sẽ được đồng bộ chính xác theo họ tên trên giấy tờ này.'],
    ).toContain('an identity card');
    expect(englishLabels['Quốc tịch']).toBe('Nationality');

    setLanguage('vi');
    expect(sourceText('WeightLifting')).toBe('Tập tạ');
    expect(sourceText('BODY SHAPES')).toBe('VÓC DÁNG CỦA BẠN');
  });
});
