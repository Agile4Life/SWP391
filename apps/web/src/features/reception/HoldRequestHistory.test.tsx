import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldRequestHistory } from './HoldRequestHistory';
import { listHolds, type HoldDetail } from '../member/holdApi';
import { setLanguage } from '../../shared/i18n/language';

vi.mock('../member/holdApi', () => ({ listHolds: vi.fn() }));
const row = (id: number, holdStatus: HoldDetail['holdStatus']): HoldDetail => ({
  id, memberId: id, memberName: `Member ${id}`, membershipCode: `MEM-${id}`, memberEmail: null, memberPhone: null,
  packageId: 1, packageName: 'Gym 6 months', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active', holdStatus,
  holdReason: 'Medical leave', holdRejectionReason: holdStatus === 'REJECTED' ? 'Missing document' : null,
  holdRequestedAt: '2026-11-01T10:00:00', holdResolvedAt: id === 3 ? null : '2026-11-02T10:00:00',
  holdStartDate: '2026-11-05', holdEndDate: '2026-11-15', cancelledEnrollmentsCount: 0, documents: [],
});

describe('HoldRequestHistory', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    setLanguage('vi'); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    vi.mocked(listHolds).mockReset().mockResolvedValue([row(1, 'APPROVED'), row(2, 'REJECTED'), row(3, 'COMPLETED'), row(4, 'PENDING'), row(5, null)]);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.unstubAllGlobals(); });
  const render = () => act(async () => root.render(<HoldRequestHistory />));
  async function filter(label: string) {
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Trạng thái bảo lưu"]')!.click());
    await act(async () => [...host.querySelectorAll<HTMLElement>('[role="option"]')].find(el => el.textContent === label)!.click());
  }

  it('shows only processed backend data, real dates/reasons and no mutation actions or fabricated fields', async () => {
    await render();
    expect(listHolds).toHaveBeenCalledWith('ALL');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(host.textContent).not.toContain('Member 4'); expect(host.textContent).not.toContain('Member 5');
    expect(host.textContent).toContain('Missing document'); expect(host.textContent).toContain('Medical leave');
    expect(host.textContent).toContain('05/11/2026');
    expect(host.querySelectorAll('tbody button, tbody a, h1, h2')).toHaveLength(0);
    const last = host.querySelector('tbody tr:last-child')!;
    expect(last.querySelector('td:last-child')?.textContent).toBe('—');
    expect(host.textContent).not.toContain('Người duyệt');
  });

  it.each([['Đã duyệt', 'Member 1'], ['Từ chối', 'Member 2'], ['Hoàn tất', 'Member 3']])('filters %s locally without another API request', async (label, member) => {
    await render(); await filter(label);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody')?.textContent).toContain(member);
    expect(listHolds).toHaveBeenCalledTimes(1);
    await filter('Tất cả trạng thái đã xử lý'); expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows an empty state for an empty list or pending-only data', async () => {
    vi.mocked(listHolds).mockResolvedValue([row(4, 'PENDING')]); await render();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Không có lịch sử bảo lưu phù hợp');
    vi.mocked(listHolds).mockResolvedValue([]);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Làm mới lịch sử bảo lưu"]')!.click());
    expect(host.querySelector('table')).toBeNull();
  });

  it('shows loading, error and retry without displaying stale rows', async () => {
    let resolve!: (rows: HoldDetail[]) => void;
    vi.mocked(listHolds).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await render(); expect(host.textContent).toContain('Đang tải lịch sử bảo lưu');
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Làm mới lịch sử bảo lưu"]')?.disabled).toBe(true);
    await act(async () => resolve([row(1, 'APPROVED')]));
    vi.mocked(listHolds).mockRejectedValueOnce(new Error('API unavailable'));
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Làm mới lịch sử bảo lưu"]')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('API unavailable');
    expect(host.querySelector('tbody')).toBeNull();
    vi.mocked(listHolds).mockResolvedValueOnce([row(3, 'COMPLETED')]);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent === 'Thử lại')!.click());
    expect(host.querySelector('tbody')?.textContent).toContain('Member 3');
  });

  it('renders English labels and the latest-record limitation', async () => {
    setLanguage('en'); await render();
    expect(host.querySelector('[aria-label="Hold status"]')).not.toBeNull();
    expect(host.textContent).toContain('Approved'); expect(host.textContent).toContain('Completed');
    expect(host.textContent).toContain('latest hold information');
    expect(host.textContent).not.toContain('Lý do');
  });
});
