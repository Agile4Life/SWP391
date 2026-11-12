import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KycReviewPage } from './KycReviewPage';

const mocks = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn() }));
vi.mock('./kycReviewApi', () => ({ listPendingKyc: mocks.list, approveKyc: mocks.approve, rejectKyc: mocks.reject }));

const submission = {
  memberId: 10, membershipCode: 'MB-010', fullName: 'Nguyen Van A', documentType: 'CCCD', citizenId: '012345678901',
  nationality: 'Việt Nam', frontImageUrl: 'data:image/png;base64,AA', backImageUrl: 'data:image/png;base64,BB', submittedAt: '2026-11-09T09:00:00',
};

describe('KycReviewPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<KycReviewPage />)); }
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label)!;

  it('shows the readable number and both photos and approves a submission', async () => {
    mocks.list.mockResolvedValue([submission]);
    mocks.approve.mockResolvedValue(null);
    await render();
    const card = host.querySelector('[data-testid="kyc-10"]')!;
    expect(card.textContent).toContain('012345678901');
    expect(card.querySelectorAll('img')).toHaveLength(2);
    await act(async () => button('Duyệt').click());
    expect(mocks.approve).toHaveBeenCalledWith(10);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('asks for a reason before rejecting', async () => {
    mocks.list.mockResolvedValue([submission]);
    mocks.reject.mockResolvedValue(null);
    await render();
    await act(async () => button('Từ chối').click());
    await act(async () => button('Xác nhận từ chối').click());
    expect(mocks.reject).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('lý do');
    const area = host.querySelector<HTMLTextAreaElement>('#kyc-reason-10')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, 'Ảnh mờ'); area.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => button('Xác nhận từ chối').click());
    expect(mocks.reject).toHaveBeenCalledWith(10, 'Ảnh mờ');
  });

  it('shows an empty state and an error state', async () => {
    mocks.list.mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain('Không có hồ sơ nào chờ duyệt');
  });

  it('picks up a submission sent after the page was opened: refresh button, timer and window focus', async () => {
    vi.useFakeTimers();
    try {
      mocks.list.mockResolvedValueOnce([]);
      await render();
      expect(host.textContent).toContain('Không có hồ sơ nào chờ duyệt');

      // A member uploads while the receptionist keeps the page open; the 30s background refresh shows it.
      mocks.list.mockResolvedValue([submission]);
      await act(async () => { vi.advanceTimersByTime(30_000); });
      expect(host.querySelector('[data-testid="kyc-10"]')).not.toBeNull();

      // The manual button and returning to the tab also re-query; a failing refresh keeps the list on screen.
      mocks.list.mockRejectedValue(new Error('offline'));
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(host.querySelector('[data-testid="kyc-10"]')).not.toBeNull();
      expect(host.querySelector('[role="alert"]')).toBeNull();
      const calls = mocks.list.mock.calls.length;
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Làm mới danh sách hồ sơ"]')!.click());
      expect(mocks.list.mock.calls.length).toBe(calls + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
