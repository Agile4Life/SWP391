import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMyInvoiceByPayment, getMyInvoicePdf } from './memberInvoicesApi';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('getMyInvoiceByPayment', () => {
  it('requests the member-owned endpoint and unwraps the invoice', async () => {
    const invoice = { paymentId: 12, invoiceNumber: 'INV-12', totalAmount: 219000 };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: invoice }) });
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('fitcenter_token', 'test-token');

    await expect(getMyInvoiceByPayment(12)).resolves.toEqual(invoice);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/invoices/my/by-payment/12', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });
});

it('downloads authenticated PDF bytes without JSON parsing', async () => {
  const pdf = new Blob(['%PDF-data'], { type: 'application/pdf' });
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/pdf' }), blob: async () => pdf });
  vi.stubGlobal('fetch', fetcher);
  localStorage.setItem('fitcenter_token', 'test-token');
  await expect(getMyInvoicePdf(12)).resolves.toBe(pdf);
  expect(fetcher).toHaveBeenCalledWith('/api/v1/invoices/my/by-payment/12/download', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
  }));
});

it('rejects an unsuccessful PDF response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: 'missing' }) }));
  await expect(getMyInvoicePdf(12)).rejects.toThrow('missing');
});
