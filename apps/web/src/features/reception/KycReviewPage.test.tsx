import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KycReviewPage } from './KycReviewPage';

const mocks = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn() }));
vi.mock('./kycReviewApi', () => ({ listPendingKyc: mocks.list, approveKyc: mocks.approve, rejectKyc: mocks.reject }));

// Dữ liệu mẫu dùng trong các ca kiểm thử.
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
  // Dựng component vào DOM giả để kiểm thử.
  async function render() { await act(async () => root.render(<KycReviewPage />)); }
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label)!;

  it('shows the readable number and both photos and confirms before approving a submission', async () => {
    mocks.list.mockResolvedValue([submission]);
    mocks.approve.mockResolvedValue(null);
    await render();
    const card = host.querySelector('[data-testid="kyc-10"]')!;
    expect(card.textContent).toContain('012345678901');
    expect(card.querySelectorAll('img')).toHaveLength(2);
    await act(async () => button('Duyệt').click());
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(host.querySelector('dialog')?.textContent).toContain('012345678901');
    await act(async () => button('Kiểm tra lại').click());
    expect(mocks.approve).not.toHaveBeenCalled();
    await act(async () => button('Duyệt').click());
    await act(async () => button('Xác nhận duyệt').click());
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

  it('shows an empty state and hides empty state on load error with Retry (P2-FE-71)', async () => {
    mocks.list.mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain('Không có hồ sơ nào chờ duyệt');

    mocks.list.mockRejectedValueOnce(new Error('Mất kết nối KYC'));
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Làm mới danh sách hồ sơ"]')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mất kết nối KYC');
    expect(host.textContent).not.toContain('Không có hồ sơ nào chờ duyệt');
  });

  it('preserves action errors on failed approval and opens in-app image zoom lightbox (P1-FE-55, P2-FE-68)', async () => {
    mocks.list.mockResolvedValue([submission]);
    mocks.approve.mockRejectedValueOnce(new Error('Hồ sơ đã bị thay đổi'));
    await render();

    // Clicking front photo opens in-app lightbox with zoom control
    const frontBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Phóng to ảnh Mặt trước"]')!;
    expect(frontBtn).not.toBeNull();
    await act(async () => frontBtn.click());
    expect(host.querySelector('.document-lightbox')).not.toBeNull();
    expect(host.textContent).toContain('Phóng to (200%)');
    await act(async () => host.querySelector<HTMLButtonElement>('.portal-dialog__close')!.click());

    // Action error survives silent refresh
    await act(async () => button('Duyệt').click());
    await act(async () => button('Xác nhận duyệt').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Hồ sơ đã bị thay đổi');
  });

  it('picks up a submission sent after the page was opened: refresh button, timer and window focus', async () => {
    vi.useFakeTimers();
    try {
      mocks.list.mockResolvedValueOnce([]);
      await render();
      expect(host.textContent).toContain('Không có hồ sơ nào chờ duyệt');

      // Hội viên tải hồ sơ lên trong khi lễ tân vẫn đang mở trang; lượt làm mới chạy nền mỗi 30 giây sẽ hiển thị nó.
      mocks.list.mockResolvedValue([submission]);
      await act(async () => { vi.advanceTimersByTime(30_000); });
      expect(host.querySelector('[data-testid="kyc-10"]')).not.toBeNull();

      // Nút làm mới thủ công và việc quay lại tab cũng truy vấn lại; lượt làm mới lỗi vẫn giữ nguyên danh sách trên màn hình.
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
