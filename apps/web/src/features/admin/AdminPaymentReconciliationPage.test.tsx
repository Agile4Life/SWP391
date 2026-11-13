import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPaymentReconciliationPage } from './AdminPaymentReconciliationPage';
import { reconciliationApi, type ReconciliationSummary, type VnpayAttemptRow } from './reconciliationApi';
import { setLanguage } from '../../shared/i18n/language';

const summary: ReconciliationSummary = {
  from: '2026-11-07', to: '2026-11-13',
  staleAttempts: 0, pendingAttempts: 3, lateRefundCount: 2, lateRefundAmount: 300000,
  ipnRetryable: 1, ipnRejected: 4, multiAttemptPayments: 1,
  anomalies: { successAttemptUnpaid: 0, walletPaymentWithoutSource: 0, total: 0 },
};

const attempt: VnpayAttemptRow = {
  reference: 'REFABC123', paymentId: 55,
  member: { userId: 7, fullName: 'Trần Minh', email: 'minh@example.com', phone: null },
  amount: 150000, status: 'success', stale: false, paymentStatus: 'success',
  targetType: 'MEMBERSHIP', targetId: 30,
  createdAt: '2026-11-13T09:00:00', expiresAt: '2026-11-13T09:15:00', gatewayTransactionNo: '14567', attemptCount: 2,
};

const page = <T,>(content: T[]) => ({ content, totalElements: content.length, totalPages: content.length ? 1 : 0, number: 0, size: 20 });

describe('AdminPaymentReconciliationPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    if (typeof HTMLDialogElement !== 'undefined') {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        value(this: HTMLDialogElement) { this.setAttribute('open', ''); }, writable: true, configurable: true,
      });
      Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        value(this: HTMLDialogElement) { this.removeAttribute('open'); }, writable: true, configurable: true,
      });
    }
    vi.spyOn(reconciliationApi, 'getSummary').mockResolvedValue(summary);
    vi.spyOn(reconciliationApi, 'getAttempts').mockResolvedValue(page([attempt]));
    vi.spyOn(reconciliationApi, 'getLateRefunds').mockResolvedValue(page([]));
    vi.spyOn(reconciliationApi, 'getIpnEvents').mockResolvedValue(page([]));
    vi.spyOn(reconciliationApi, 'getTimeline').mockResolvedValue({
      payment: {
        id: 55, member: attempt.member, amount: 150000, refundedAmount: null, method: 'online_wallet', status: 'success',
        targetType: 'MEMBERSHIP', targetId: 30, createdAt: '2026-11-13T08:55:00', paidAt: '2026-11-13T09:02:00', invoiceNumber: 'INV-55',
      },
      attempts: [attempt], callbacks: [], walletTransactions: [],
      entries: [
        { at: '2026-11-13T08:55:00', type: 'PAYMENT_CREATED', reference: null, status: 'pending', code: null, source: null, amount: 150000, detail: 'online_wallet' },
        { at: '2026-11-13T09:01:00', type: 'CALLBACK_RECEIVED', reference: 'REFABC123', status: '00', code: '00', source: 'IPN', amount: 150000, detail: '14567' },
      ],
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const render = async () => { await act(async () => { root.render(<AdminPaymentReconciliationPage />); }); };
  const click = async (el: Element | null) => { expect(el).not.toBeNull(); await act(async () => { (el as HTMLElement).click(); }); };

  it('shows a loading state, then the overview and attempts with a 7-day default range', async () => {
    let resolve: (value: ReconciliationSummary) => void = () => {};
    vi.mocked(reconciliationApi.getSummary).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    await render();
    expect(host.textContent).toContain('Đang tải tổng quan');
    await act(async () => { resolve(summary); });
    expect(host.textContent).toContain('Đối soát thanh toán');
    expect(host.textContent).toContain('Hoàn tiền tự động');
    expect(host.textContent).toContain('REFABC123');
    expect(host.textContent).toContain('Trần Minh');
    expect(host.textContent).toContain('Gói tập #30');
    expect(host.querySelector('[role="status"]')).toBeNull();
    const call = vi.mocked(reconciliationApi.getSummary).mock.calls[0][0]!;
    const days = (Date.parse(call.to!) - Date.parse(call.from!)) / 86_400_000;
    expect(days).toBe(6);
    expect(reconciliationApi.getAttempts).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 20, from: call.from, to: call.to }));
  });

  it('warns when attempts are stuck or anomalies exist and jumps to stuck attempts', async () => {
    vi.mocked(reconciliationApi.getSummary).mockResolvedValue({
      ...summary, staleAttempts: 2, anomalies: { successAttemptUnpaid: 1, walletPaymentWithoutSource: 0, total: 1 },
    });
    await render();
    const warnings = Array.from(host.querySelectorAll('[role="status"]')).map((el) => el.textContent);
    expect(warnings.some((w) => w?.includes('job đóng giao dịch treo có thể không chạy'))).toBe(true);
    expect(warnings.some((w) => w?.includes('bất thường cần kiểm tra'))).toBe(true);
    await click(Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Xem lượt treo') ?? null);
    expect(reconciliationApi.getAttempts).toHaveBeenLastCalledWith(expect.objectContaining({ stale: true, status: 'ALL', page: 0 }));
  });

  it('shows empty and error states with retry', async () => {
    vi.mocked(reconciliationApi.getAttempts).mockResolvedValueOnce(page([]));
    vi.mocked(reconciliationApi.getSummary).mockRejectedValueOnce(new Error('Máy chủ lỗi'));
    await render();
    expect(host.textContent).toContain('Không có lượt VNPay nào phù hợp.');
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Máy chủ lỗi');
    await click(alert!.querySelector('button'));
    expect(reconciliationApi.getSummary).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('IPN cần gửi lại (99)');
  });

  it('retries a failed list', async () => {
    vi.mocked(reconciliationApi.getAttempts).mockRejectedValueOnce(new Error('Không kết nối được'));
    await render();
    const alert = Array.from(host.querySelectorAll('[role="alert"]')).find((a) => a.textContent?.includes('Không kết nối được'));
    await click(alert!.querySelector('button'));
    expect(reconciliationApi.getAttempts).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('REFABC123');
  });

  it('switches tabs and passes filters to the API', async () => {
    await render();
    const tab = (label: string) => Array.from(host.querySelectorAll('[role="tab"]')).find((b) => b.textContent === label) ?? null;
    await click(tab('Hoàn tiền tự động'));
    expect(reconciliationApi.getLateRefunds).toHaveBeenCalledWith(expect.objectContaining({ page: 0 }));
    expect(host.textContent).toContain('Không có khoản hoàn tiền tự động nào');
    await click(tab('Sự kiện IPN'));
    expect(reconciliationApi.getIpnEvents).toHaveBeenCalled();
    const input = host.querySelector('input[aria-label="Lọc theo mã giao dịch"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'REFABC123');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { input.form!.requestSubmit(); });
    expect(reconciliationApi.getIpnEvents).toHaveBeenLastCalledWith(expect.objectContaining({ reference: 'REFABC123', page: 0 }));
  });

  it('opens the payment timeline from a row', async () => {
    await render();
    await click(host.querySelector('button[aria-label="Xem dòng thời gian thanh toán #55"]'));
    expect(reconciliationApi.getTimeline).toHaveBeenCalledWith(55);
    expect(host.textContent).toContain('Dòng thời gian thanh toán #55');
    expect(host.textContent).toContain('INV-55');
    expect(host.textContent).toContain('Nhận phản hồi VNPay');
    expect(host.textContent).toContain('00 · Đã ghi nhận');
  });

  it('renders English labels', async () => {
    await render();
    await act(async () => { setLanguage('en'); });
    expect(host.textContent).toContain('Payment reconciliation');
    expect(host.textContent).toContain('Automatic refunds');
    expect(host.textContent).toContain('Membership #30');
    expect(host.textContent).not.toContain('Hoàn tiền tự động');
  });
});
