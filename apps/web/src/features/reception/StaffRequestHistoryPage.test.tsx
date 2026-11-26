import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StaffRequestHistoryPage } from './StaffRequestHistoryPage';
import { getCurrentUser } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n/language';

const mocks = vi.hoisted(() => ({
  requestHistory: vi.fn(),
  topupHistory: vi.fn(),
}));

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
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['MEMBER', 'COACH', 'ADMIN'] as const)('blocks unauthorized role %s with forbidden guard', async (role) => {
    vi.mocked(getCurrentUser).mockReturnValue({ id: 'u1', name: 'User', identifier: 'u1', role });
    await act(async () => root.render(<MemoryRouter><StaffRequestHistoryPage /></MemoryRouter>));

    expect(host.querySelector('[data-testid="reception-history-forbidden-guard"]')).not.toBeNull();
    expect(host.textContent).toContain('Không có quyền truy cập');
    expect(mocks.requestHistory).not.toHaveBeenCalled();
    expect(mocks.topupHistory).not.toHaveBeenCalled();
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
    expect(host.textContent).toContain('Lịch sử giao dịch');
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
});
