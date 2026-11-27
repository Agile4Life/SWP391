import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberInvoicesPage } from './MemberInvoicesPage';
import { ApiError } from '../../shared/api/client';
import { PortalIcon } from '../portal/PortalIcon';
import { PORTAL_NAV } from '../portal/portalNavigation';

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
  // Dựng component vào DOM giả để kiểm thử.
  async function render() { await act(async () => root.render(<MemoryRouter><MemberInvoicesPage /></MemoryRouter>)); }

  it('names a wallet top-up payment as a SÖL wallet top-up instead of "Khác"', async () => {
    mocks.payments.mockResolvedValue([{ ...paid, id: 19, amount: 1000000, serviceType: 'WALLET_TOPUP' }]);
    await render();
    const row = host.querySelector('.member-invoices__table')?.textContent ?? '';
    expect(row).toContain('Nạp tiền vào ví SÖL');
    expect(row).not.toContain('Khác');
  });

  it('separates pending VNPay checkout from successful invoice history', async () => {
    let resolve!: (value: unknown[]) => void;
    mocks.payments.mockReturnValue(new Promise((done) => { resolve = done; }));
    await render();
    expect(host.textContent).toContain('Đang tải giao dịch');
    expect(host.querySelector('[role="status"] [aria-hidden="true"]')).not.toBeNull();
    expect(host.querySelector('.portal-container.member-invoices')).not.toBeNull();
    await act(async () => resolve([paid, { ...paid, id: 13, status: 'pending' }]));
    expect(host.textContent).toContain('#12');
    expect(host.querySelector('.member-invoices__table')?.textContent).not.toContain('#13');
    expect(host.querySelector('[aria-label="Khoản chờ thanh toán"]')?.textContent).toContain('#13');
    expect(host.textContent).toContain('Thanh toán VNPay');
  });

  it('P0-04: hides SÖL Wallet pay button for pending WALLET_TOPUP payments while keeping it for other services', async () => {
    mocks.payments.mockResolvedValue([
      { ...paid, id: 21, status: 'pending', serviceType: 'WALLET_TOPUP', amount: 500000 },
      { ...paid, id: 22, status: 'pending', serviceType: 'CLASS', serviceName: 'Yoga Sáng', amount: 200000 },
    ]);
    await render();

    const topupRow = host.querySelector('[data-testid="pending-payment-21"]')!;
    expect(topupRow.textContent).toContain('Thanh toán VNPay');
    expect(topupRow.querySelector('[data-testid="pay-with-wallet-btn"]')).toBeNull();

    const classRow = host.querySelector('[data-testid="pending-payment-22"]')!;
    expect(classRow.textContent).toContain('Thanh toán VNPay');
    expect(classRow.querySelector('[data-testid="pay-with-wallet-btn"]')).not.toBeNull();
  });

  it('shows an invoice skeleton until the detail request settles without a display delay', async () => {
    mocks.payments.mockResolvedValue([paid]);
    let finish!: (value: unknown) => void;
    mocks.invoice.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem hóa đơn giao dịch #12"]')?.click());
    expect(host.querySelector('.member-invoices__invoice [role="status"] [aria-hidden="true"]')).not.toBeNull();
    expect(host.querySelector('.member-invoices__download')).toBeNull();
    await act(async () => finish({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 }));
    expect(host.querySelector('.member-invoices__invoice [role="status"]')).toBeNull();
    expect(host.textContent).toContain('INV-12');
  });

  it('opens owned invoice, shows persisted total and downloads its PDF', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 219000 });
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mocks.invoice).toHaveBeenCalledWith(12);
    expect(host.textContent).toContain('INV-12');
    expect(host.textContent).toContain('219.000');
    // Cả danh sách lẫn hóa đơn đều hiển thị giờ trong ngày, không chỉ ngày.
    expect(host.textContent).toContain('10:00 25/10/2026');
    expect(host.textContent).toContain('Phát hành lúc 10:00 25/10/2026');
    expect(host.textContent).toContain('Thanh toán lúc10:00 25/10/2026');
    expect(host.querySelector('.member-invoices__download')).toBeNull();
    expect(host.querySelector('.member-invoices__preview-btn')?.classList.contains('btn-primary')).toBe(true);
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    mocks.pdf.mockResolvedValue(blob);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__preview-btn')?.click());
    expect(mocks.pdf).toHaveBeenCalledWith(12);
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(host.querySelector<HTMLIFrameElement>('.member-invoices__pdf-frame')?.getAttribute('src')).toBe('about:blank');
    expect(host.querySelector('.member-invoices__download')?.classList.contains('btn-primary')).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__download')?.click());
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__pdf-modal button[aria-label^="Đóng"]')?.click());
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledWith('about:blank');
    createUrl.mockRestore();
    revokeUrl.mockRestore();
    click.mockRestore();
  });

  it('shows PDF download error and allows retry', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 });
    mocks.pdf.mockRejectedValueOnce(new Error('offline'));
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__preview-btn')?.click());
    expect(host.textContent).toContain('Không tải được file hóa đơn');
  });

  it('disables download while the PDF request is pending', async () => {
    mocks.payments.mockResolvedValue([paid]);
    mocks.invoice.mockResolvedValue({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 });
    mocks.pdf.mockReturnValue(new Promise(() => {}));
    await render();
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__preview-btn')?.click());
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Đang tải file'));
    expect(button?.disabled).toBe(true);
  });

  it('shows empty, list error, and missing-invoice states', async () => {
    mocks.payments.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([paid]);
    mocks.invoice.mockRejectedValue(new ApiError('missing', 404));
    await render();
    expect(host.textContent).toContain('Chưa có giao dịch');
    // Dựng lại component để kiểm tra lỗi yêu cầu một cách độc lập.
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(host.textContent).toContain('Không tải được giao dịch');
    expect(host.querySelector('.member-invoices__error[role="alert"]')).not.toBeNull();
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Thử lại')?.click());
    await act(async () => host.querySelector('button[aria-label="Xem hóa đơn giao dịch #12"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.textContent).toContain('chưa có hóa đơn điện tử');
  });

  it('uses a receipt icon for invoices while preserving the membership card icon', async () => {
    expect(PORTAL_NAV.find((item) => item.to === '/member/invoices')?.icon).toBe('receipt');
    expect(PORTAL_NAV.find((item) => item.to === '/member/card')?.icon).toBe('card');
    await act(async () => root.render(<><PortalIcon name="receipt" /><PortalIcon name="card" /></>));
    const icons = host.querySelectorAll('svg');
    expect(icons[0].getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icons[0].getAttribute('stroke-width')).toBe(icons[1].getAttribute('stroke-width'));
    expect(icons[0].querySelector('path')?.getAttribute('d')).not.toBe(icons[1].querySelector('path')?.getAttribute('d'));
  });

  it('P2-FE-48: displays refunded transactions, matches pending case-insensitively, and resets downloadError on invoice change', async () => {
    const refunded = { ...paid, id: 14, amount: 300000, status: 'REFUNDED' };
    const upperPending = { ...paid, id: 15, amount: 400000, status: 'PENDING', serviceType: 'MEMBERSHIP' as const };
    mocks.payments.mockResolvedValue([paid, refunded, upperPending]);
    mocks.invoice
      .mockResolvedValueOnce({ paymentId: 12, invoiceNumber: 'INV-12', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 200000, taxAmount: 20000, totalAmount: 220000 })
      .mockResolvedValueOnce({ paymentId: 14, invoiceNumber: 'INV-14', issuedAt: '2026-10-25T10:00:00', subtotalAmount: 270000, taxAmount: 30000, totalAmount: 300000 });
    mocks.pdf.mockRejectedValueOnce(new Error('offline'));

    await render();
    expect(host.querySelector('[aria-label="Khoản chờ thanh toán"]')?.textContent).toContain('#15');
    const tableText = host.querySelector('.member-invoices__table')?.textContent ?? '';
    expect(tableText).toContain('#14');
    expect(tableText).toContain('Đã hoàn tiền');

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem hóa đơn giao dịch #12"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('.member-invoices__preview-btn')?.click());
    expect(host.textContent).toContain('Không tải được file hóa đơn');

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Đóng"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Xem hóa đơn giao dịch #14"]')?.click());
    expect(host.textContent).not.toContain('Không tải được file hóa đơn');
  });
});
