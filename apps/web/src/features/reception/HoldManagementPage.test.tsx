import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldManagementPage } from './HoldManagementPage';

const mocks = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn(), document: vi.fn() }));
vi.mock('../member/holdApi', async (original) => ({
  ...await original<typeof import('../member/holdApi')>(),
  listHolds: mocks.list, approveHold: mocks.approve, rejectHold: mocks.reject, fetchHoldDocument: mocks.document,
}));

const pending = {
  id: 7, memberName: 'Nguyen Van A', membershipCode: 'MB-007', packageName: 'GOLD 3 THÁNG', startDate: '2026-11-01', endDate: '2027-01-29',
  holdStatus: 'PENDING', holdReason: 'Phẫu thuật', holdRequestedAt: '2026-11-09T09:00:00', holdStartDate: '2026-11-12', holdEndDate: '2026-11-20',
  documents: [{ id: 3, fileName: 'giay-ra-vien.pdf', contentType: 'application/pdf', sizeBytes: 100, uploadedAt: '2026-11-09T09:00:00' }],
};

describe('HoldManagementPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<HoldManagementPage />)); }

  it('lists pending requests with dates, reason and documents and approves one', async () => {
    mocks.list.mockResolvedValue([pending]);
    mocks.approve.mockResolvedValue({});
    await render();
    expect(mocks.list).toHaveBeenCalledWith('PENDING');
    const card = host.querySelector('[data-testid="hold-7"]')!;
    expect(card.textContent).toContain('Nguyen Van A');
    expect(card.textContent).toContain('Phẫu thuật');
    expect(card.textContent).toContain('giay-ra-vien.pdf');
    await act(async () => [...card.querySelectorAll('button')].find((button) => button.textContent === 'Duyệt bảo lưu')!.click());
    expect(mocks.approve).toHaveBeenCalledWith(7);
  });

  it('switches the filter to read the hold history without decision buttons', async () => {
    mocks.list.mockResolvedValueOnce([pending]).mockResolvedValueOnce([{ ...pending, holdStatus: 'COMPLETED' }]);
    await render();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((button) => button.textContent === 'Đã hoàn tất')!.click());
    expect(mocks.list).toHaveBeenLastCalledWith('COMPLETED');
    expect([...host.querySelectorAll('button')].some((button) => button.textContent === 'Duyệt bảo lưu')).toBe(false);
  });

  it('shows an empty state and an error state', async () => {
    mocks.list.mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain('Không có yêu cầu bảo lưu nào');
    mocks.list.mockRejectedValueOnce(new Error('Không có quyền'));
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((button) => button.textContent === 'Tất cả')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không có quyền');
  });
});
