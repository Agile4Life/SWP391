import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { StaffRequestHistoryPage } from './StaffRequestHistoryPage';
import { getCurrentUser } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n/language';

const mocks = vi.hoisted(() => ({
  requestHistory: vi.fn(),
  topupHistory: vi.fn(),
  holds: vi.fn(),
}));
vi.mock('../member/holdApi', () => ({ listHolds: mocks.holds }));

vi.mock('./receptionApi', async (original) => ({
  ...await original<typeof import('./receptionApi')>(),
  receptionApi: {
    getRequestHistory: mocks.requestHistory,
    getCounterTopupHistory: mocks.topupHistory,
  },
}));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: vi.fn() }));

describe('StaffRequestHistoryPage (P2-E2E-02)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.requestHistory.mockReset().mockResolvedValue([]);
    mocks.topupHistory.mockReset().mockResolvedValue([]);
    mocks.holds.mockReset().mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['', '?tab=membership', '?tab=wallet', '?tab=holds', '?tab=invalid'])('opens the correct history panel for %s', async search => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 's1', name: 'Staff', identifier: 's1', role: 'STAFF' });
    await act(async () => root.render(<MemoryRouter initialEntries={['/staff/reception-history' + search]}><StaffRequestHistoryPage /></MemoryRouter>));
    const walletActive = search === '?tab=wallet';
    expect(host.querySelector('[data-history-panel="membership"]')?.hasAttribute('hidden')).toBe(walletActive || search === '?tab=holds');
    expect(host.querySelector('[data-history-panel="wallet"]')?.hasAttribute('hidden')).toBe(!walletActive);
    expect(host.querySelector('[data-history-panel="holds"]')?.hasAttribute('hidden')).toBe(search !== '?tab=holds');
    expect(host.querySelectorAll('h1, h2')).toHaveLength(0);
    expect(host.querySelectorAll('.portal-section-tab.active')).toHaveLength(1);
  });

  it('preserves filters and data across tabs, browser Back/Forward, and unrelated query parameters', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 's1', name: 'Staff', identifier: 's1', role: 'STAFF' });
    const router = createMemoryRouter([{ path: '/staff/reception-history', element: <StaffRequestHistoryPage /> }], { initialEntries: ['/staff/reception-history?source=notice'] });
    await act(async () => root.render(<RouterProvider router={router} />));
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Tìm lịch sử gói tập"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'MEM-164');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const wallet = host.querySelector<HTMLAnchorElement>('a[href*="tab=wallet"]')!;
    expect(wallet).not.toBeNull();
    await act(async () => wallet.click());
    expect(router.state.location.search).toContain('source=notice');
    expect(router.state.location.search).toContain('tab=wallet');
    await act(async () => router.navigate(-1));
    expect(search.value).toBe('MEM-164');
    expect(host.querySelector('[data-history-panel="membership"]')?.hasAttribute('hidden')).toBe(false);
    await act(async () => router.navigate(1));
    expect(host.querySelector('[data-history-panel="wallet"]')?.hasAttribute('hidden')).toBe(false);
    expect(mocks.requestHistory).toHaveBeenCalledTimes(1);
    expect(mocks.topupHistory).toHaveBeenCalledTimes(1);
  });

  it.each(['MEMBER', 'COACH', 'ADMIN'] as const)('blocks unauthorized role %s with forbidden guard', async (role) => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 'u1', name: 'User', identifier: 'u1', role });
    await act(async () => root.render(<MemoryRouter><StaffRequestHistoryPage /></MemoryRouter>));

    expect(host.querySelector('[data-testid="reception-history-forbidden-guard"]')).not.toBeNull();
    expect(host.textContent).toContain('Không có quyền truy cập');
    expect(mocks.requestHistory).not.toHaveBeenCalled();
    expect(mocks.topupHistory).not.toHaveBeenCalled();
    expect(mocks.holds).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'MANAGER'] as const)('renders both membership request history and wallet top-up history for %s', async (role) => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 's1', name: 'Lễ tân', identifier: 's1', role });
    mocks.requestHistory.mockResolvedValueOnce([
      {
        subscriptionId: 101,
        type: 'REGISTER',
        outcome: 'APPROVED',
        memberId: 5,
        membershipCode: 'MB-005',
        memberName: 'Nguyễn Minh',
        packageName: 'GOLD 3 THÁNG',
        previousPackageName: null,
        amount: 2500000,
        paymentMethod: 'cash',
        processedAt: '2026-11-25T09:00:00',
        processedByName: 'Lễ tân Hà',
      },
    ]);
    mocks.topupHistory.mockResolvedValueOnce([
      {
        paymentId: 202,
        memberId: 5,
        membershipCode: 'MB-005',
        memberName: 'Nguyễn Minh',
        amount: 500000,
        paymentMethod: 'cash',
        paidAt: '2026-11-25T09:30:00',
        receivedByName: 'Lễ tân Hà',
      },
    ]);

    await act(async () => root.render(<MemoryRouter><StaffRequestHistoryPage /></MemoryRouter>));

    expect(host.querySelector('[data-testid="reception-history-forbidden-guard"]')).toBeNull();
    expect(host.querySelectorAll('h1, h2')).toHaveLength(0);
    expect(host.querySelector('[data-testid="request-history"]')?.textContent).toContain('GOLD 3 THÁNG');
    expect(host.querySelector('[data-testid="wallet-topup-history"]')?.textContent).toContain('500.000');
  });

  it('switches page heading cleanly to English', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 's1', name: 'Staff', identifier: 's1', role: 'STAFF' });
    setLanguage('en');
    await act(async () => root.render(<MemoryRouter><StaffRequestHistoryPage /></MemoryRouter>));
    expect(host.querySelector('[data-testid="request-history"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="wallet-topup-history"]')).not.toBeNull();
  });

  it('preserves hold filters through tab changes and Back/Forward without refetching', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 's1', name: 'Staff', identifier: 's1', role: 'STAFF' });
    const router = createMemoryRouter([{ path: '/staff/reception-history', element: <StaffRequestHistoryPage /> }], { initialEntries: ['/staff/reception-history?tab=holds&source=notice'] });
    await act(async () => root.render(<RouterProvider router={router} />));
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Trạng thái bảo lưu"]')!;
    await act(async () => trigger.click());
    await act(async () => [...host.querySelectorAll<HTMLElement>('[role="option"]')].find(el => el.textContent === 'Từ chối')!.click());
    await act(async () => host.querySelector<HTMLAnchorElement>('a[href*="tab=wallet"]')!.click());
    await act(async () => router.navigate(-1));
    expect(host.querySelector('[data-history-panel="holds"]')?.hasAttribute('hidden')).toBe(false);
    expect(trigger.textContent).toContain('Từ chối');
    expect(router.state.location.search).toContain('source=notice');
    await act(async () => router.navigate(1));
    expect(host.querySelector('[data-history-panel="wallet"]')?.hasAttribute('hidden')).toBe(false);
    expect(mocks.holds).toHaveBeenCalledTimes(1);
    expect(mocks.holds).toHaveBeenCalledWith('ALL');
  });

  it('does not expose or fetch holds for Manager because the endpoint is Receptionist-only', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 'm1', name: 'Manager', identifier: 'm1', role: 'MANAGER' });
    await act(async () => root.render(<MemoryRouter initialEntries={['/staff/reception-history?tab=holds']}><StaffRequestHistoryPage /></MemoryRouter>));
    expect(host.querySelector('a[href*="tab=holds"]')).toBeNull();
    expect(host.querySelector('[data-history-panel="membership"]')?.hasAttribute('hidden')).toBe(false);
    expect(mocks.holds).not.toHaveBeenCalled();
  });
});
