import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberInvoicesPage } from './MemberInvoicesPage';
import { ApiError } from '../../shared/api/client';

const mocks = vi.hoisted(() => ({ payments: vi.fn(), invoice: vi.fn(), pdf: vi.fn() }));
vi.mock('./membershipApi', async (original) => ({ ...await original<typeof import('./membershipApi')>(), getMyPayments: mocks.payments }));
vi.mock('./memberInvoicesApi', async (original) => ({ ...await original<typeof import('./memberInvoicesApi')>(), getMyInvoiceByPayment: mocks.invoice, getMyInvoicePdf: mocks.pdf }));

const paid = { id: 12, amount: 250000, paidAt: '2026-10-25T10:00:00', status: 'success' };

describe('MemberInvoicesPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    mocks.payments.mockReset(); mocks.invoice.mockReset(); mocks.pdf.mockReset();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<MemberInvoicesPage />)); }

  it('shows loading, then only successful transactions from my-payments API', async () => {
    let resolve!: (value: unknown[]) => void;
    mocks.payments.mockReturnValue(new Promise((done) => { resolve = done; }));
    await render();
    expect(host.textContent).toContain('Đang tải giao dịch');
    await act(async () => resolve([paid, { ...paid, id: 13, status: 'pending' }]));
    expect(host.textContent).toContain('#12');
    expect(host.textContent).not.toContain('#13');
  });

  it('opens owned invoice, shows persisted total and downloads its PDF', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 219000 });
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mocks.invoice).toHaveBeenCalledWith(12);
    expect(host.textContent).toContain('INV-12');
    expect(host.textContent).toContain('219.000');
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    mocks.pdf.mockResolvedValue(blob);
    const createUrl = vi.fn().mockReturnValue('blob:test');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Tải hóa đơn'))?.click());
    expect(mocks.pdf).toHaveBeenCalledWith(12);
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
  });

  it('shows PDF download error and allows retry', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 });
    mocks.pdf.mockRejectedValueOnce(new Error('offline'));
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Tải hóa đơn'))?.click());
    expect(host.textContent).toContain('Không tải được file hóa đơn');
  });

  it('disables download while the PDF request is pending', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 });
    mocks.pdf.mockReturnValue(new Promise(() => {}));
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Tải hóa đơn'))?.click());
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Đang tải file'));
    expect(button?.disabled).toBe(true);
  });

  it('shows empty, list error, and missing-invoice states', async () => {
    mocks.payments.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([paid]);
    mocks.invoice.mockRejectedValue(new ApiError('missing', 404));
    await render();
    expect(host.textContent).toContain('Chưa có giao dịch');
    // Remount to exercise the request failure independently.
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(host.textContent).toContain('Không tải được giao dịch');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Thử lại')?.click());
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.textContent).toContain('chưa có hóa đơn điện tử');
  });
});
