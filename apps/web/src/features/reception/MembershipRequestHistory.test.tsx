import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipRequestHistory } from './MembershipRequestHistory';
import type { RequestHistoryItem } from './receptionApi';
import { setLanguage } from '../../shared/i18n/language';

const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('./receptionApi', async (original) => ({
  ...await original<typeof import('./receptionApi')>(),
  receptionApi: { getRequestHistory: mocks.history },
}));

const sampleItems: RequestHistoryItem[] = [
  {
    subscriptionId: 10,
    type: 'REGISTER',
    outcome: 'APPROVED',
    memberId: 1,
    membershipCode: 'MB-001',
    memberName: 'Nguyễn Văn An',
    packageName: 'SILVER 3 THÁNG',
    previousPackageName: null,
    amount: 1500000,
    paymentMethod: 'cash',
    processedAt: '2026-11-24T10:00:00',
    processedByName: 'Lễ tân Lan',
  },
  {
    subscriptionId: 11,
    type: 'UPGRADE',
    outcome: 'APPROVED',
    memberId: 2,
    membershipCode: 'MB-002',
    memberName: 'Trần Thị Bình',
    packageName: 'PLATINUM 3 THÁNG',
    previousPackageName: 'GOLD 3 THÁNG',
    amount: 3200000,
    paymentMethod: 'online_wallet',
    processedAt: '2026-11-25T15:30:00',
    processedByName: null,
  },
  {
    subscriptionId: 12,
    type: 'RENEW',
    outcome: 'CANCELLED',
    memberId: 3,
    membershipCode: null,
    memberName: 'Lê Hoàng Cường',
    packageName: 'GOLD 6 THÁNG',
    previousPackageName: null,
    amount: null,
    paymentMethod: null,
    processedAt: '2026-11-23T08:15:00',
    processedByName: 'Lễ tân Hà',
  },
];

describe('MembershipRequestHistory (P2-E2E-02)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.history.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lists processed membership requests including upgrade transitions and self-paid members', async () => {
    mocks.history.mockResolvedValueOnce(sampleItems);
    await act(async () => root.render(<MembershipRequestHistory />));

    expect(mocks.history).toHaveBeenCalledWith(30);
    const rows = host.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    // Default newest first -> subscription #11 first
    expect(rows[0].textContent).toContain('GOLD 3 THÁNG → PLATINUM 3 THÁNG');
    expect(rows[0].textContent).toContain('Hội viên tự thanh toán');
    expect(rows[0].textContent).toContain('3.200.000');
    expect(rows[1].textContent).toContain('Nguyễn Văn An');
    expect(rows[2].textContent).toContain('Đã hủy');
  });

  it('filters by search query, type, outcome, and distinguishes 0 filter matches from empty history (P2-FE-71)', async () => {
    mocks.history.mockResolvedValueOnce(sampleItems);
    await act(async () => root.render(<MembershipRequestHistory />));

    const typeSelect = host.querySelector('select[aria-label="Loại yêu cầu"]') as HTMLSelectElement;
    await act(async () => {
      typeSelect.value = 'UPGRADE';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody')?.textContent).toContain('Trần Thị Bình');

    const searchInput = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, 'khong-ton-tai');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).toContain('Không có yêu cầu nào khớp từ khóa hoặc bộ lọc hiện tại.');
    expect(host.textContent).not.toContain('Chưa có yêu cầu nào được xử lý trong khoảng thời gian này.');
  });

  it('renders empty state when backend returns no history', async () => {
    mocks.history.mockResolvedValueOnce([]);
    await act(async () => root.render(<MembershipRequestHistory />));
    expect(host.textContent).toContain('Chưa có yêu cầu nào được xử lý trong khoảng thời gian này.');
  });

  it('shows .portal-alert error with retry button on API failure and reloads on days change (P2-FE-71)', async () => {
    mocks.history.mockRejectedValueOnce(new Error('Máy chủ bận')).mockResolvedValueOnce([sampleItems[0]]);
    await act(async () => root.render(<MembershipRequestHistory />));

    const alert = host.querySelector('.portal-alert[role="alert"]');
    expect(alert?.textContent).toContain('Máy chủ bận');
    const retryBtn = alert!.querySelector('button')!;
    await act(async () => retryBtn.click());

    expect(mocks.history).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);

    mocks.history.mockResolvedValueOnce([]);
    const daysSelect = host.querySelector('select[aria-label="Khoảng thời gian"]') as HTMLSelectElement;
    await act(async () => {
      daysSelect.value = '7';
      daysSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mocks.history).toHaveBeenLastCalledWith(7);
  });
});
