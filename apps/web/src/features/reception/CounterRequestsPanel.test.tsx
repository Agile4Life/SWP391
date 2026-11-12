import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterRequestsPanel } from './CounterRequestsPanel';
import type { CounterQueue } from './useCounterQueue';

const mocks = vi.hoisted(() => ({ processPayment: vi.fn(), cancel: vi.fn(), confirmPt: vi.fn() }));
vi.mock('./receptionApi', () => ({
  receptionApi: { processPayment: mocks.processPayment, cancelPendingSubscription: mocks.cancel, confirmCoachBookingPayment: mocks.confirmPt },
}));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: () => ({ id: 'qly', name: 'Quản Lý', identifier: 'qly', role: 'MANAGER' }), apiFetch: vi.fn() }));
vi.mock('./PaymentInvoice', () => ({ PaymentInvoice: ({ memberName, onClose }: { memberName: string; onClose: () => void }) => <div data-testid="invoice">{memberName}<button onClick={onClose}>close</button></div> }));

const request = {
  id: 31, memberId: 7, membershipCode: 'MEM-7', memberName: 'Nguyễn Văn An', memberEmail: 'an@example.com', memberPhone: '0912345678',
  packageId: 3, packageName: 'GOLD', durationDays: 30, packagePrice: 299000, startDate: '2026-11-12', endDate: '2026-12-11', status: 'pending_payment', createdAt: '2026-11-12T09:00:00',
};
const session = { id: 90, memberName: 'Trần Thu Bình', coachName: 'Hùng', bookingDate: '2026-11-13', startTime: '10:00:00', endTime: '11:00:00', hourlyRate: 200000, status: 'confirmed' };

describe('CounterRequestsPanel (manager)', () => {
  let host: HTMLDivElement;
  let root: Root;
  const reload = vi.fn();
  const queue = (over: Partial<CounterQueue> = {}) => ({ pending: [request], unpaidPt: [session], loading: false, error: null, reload, count: 2, ...over }) as unknown as CounterQueue;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    Object.values(mocks).forEach((mock) => mock.mockReset());
    reload.mockReset().mockResolvedValue(undefined);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = (q: CounterQueue) => act(async () => root.render(<CounterRequestsPanel queue={q} />));
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label)!;

  it('lists membership requests and unpaid 1:1 sessions with their price', async () => {
    await render(queue());
    expect(host.querySelector('[data-testid="counter-request-31"]')?.textContent).toContain('Nguyễn Văn An');
    expect(host.querySelector('[data-testid="counter-request-31"]')?.textContent).toContain('GOLD');
    expect(host.querySelector('[data-testid="counter-pt-90"]')?.textContent).toContain('Trần Thu Bình');
    expect(host.textContent).toContain('Gói tập chờ thu tiền (1)');
    expect(host.textContent).toContain('Buổi PT 1:1 chờ thu tiền (1)');
  });

  it('collects a membership payment with the chosen method, shows the invoice and refreshes the queue', async () => {
    mocks.processPayment.mockResolvedValue({ id: 5, memberId: 7, amount: 299000, method: 'pos', status: 'success', paidAt: '2026-11-12T10:00:00', invoiceNumber: 'INV-1' });
    await render(queue());
    const method = host.querySelector<HTMLSelectElement>('#counter-method-31')!;
    await act(async () => { method.value = 'pos'; method.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => button('Xác nhận thu tiền').click());
    expect(mocks.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 7, subscriptionId: 31, packageId: 3, amount: 299000, method: 'pos' }));
    expect(host.querySelector('[data-testid="invoice"]')?.textContent).toContain('Nguyễn Văn An');
    expect(reload).toHaveBeenCalled();
  });

  it('asks before cancelling a request and only then cancels it', async () => {
    mocks.cancel.mockResolvedValue(undefined);
    await render(queue());
    await act(async () => button('Hủy yêu cầu').click());
    expect(mocks.cancel).not.toHaveBeenCalled();
    const confirmButton = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find((item) => item.textContent === 'Hủy yêu cầu')!;
    await act(async () => confirmButton.click());
    expect(mocks.cancel).toHaveBeenCalledWith(31);
    expect(reload).toHaveBeenCalled();
  });

  it('confirms an unpaid 1:1 session as cash or bank transfer', async () => {
    mocks.confirmPt.mockResolvedValue(session);
    await render(queue());
    await act(async () => button('Đã nhận chuyển khoản').click());
    expect(mocks.confirmPt).toHaveBeenCalledWith(90, 'bank_transfer');
  });

  it('shows empty and error states', async () => {
    await render(queue({ pending: [], unpaidPt: [], count: 0 }));
    expect(host.textContent).toContain('Không có yêu cầu gói tập nào chờ thu tiền');
    expect(host.textContent).toContain('Không có buổi PT nào chờ thu tiền');
    await render(queue({ pending: [], unpaidPt: [], count: 0, error: 'Không tải được' }));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tải được');
  });
});
