import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PaymentInvoice } from './PaymentInvoice';
import { setLanguage } from '../../shared/i18n/language';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLanguage('vi');
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setLanguage('vi');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('prints a separate invoice with the confirmed payment and no dialog controls', async () => {
  const print = vi.fn();
  vi.stubGlobal('print', print);
  const close = vi.fn();
  await act(async () => root.render(<PaymentInvoice
    payment={{ id: 90, memberId: 12, amount: 1500000, method: 'bank_transfer', status: 'success',
      paidAt: '2026-10-22T10:30:00', invoiceNumber: 'INV-20261022-00090' }}
    memberName="Nguyễn Văn An" membershipCode="MB-2026-012"
    packageName="Gói Sanctuary" cashierName="Lễ tân Mai" onClose={close}
  />));

  const copy = document.body.querySelector(':scope > .invoice-print-root')!;
  expect(copy).not.toBeNull();
  expect(copy.textContent).toContain('INV-20261022-00090');
  expect(copy.textContent).toContain('Nguyễn Văn An');
  expect(copy.textContent).toContain('MB-2026-012');
  expect(copy.textContent).toContain('Chuyển khoản');
  expect(copy.textContent).toContain('22/10/2026');
  expect(copy.querySelector('tbody tr')?.textContent).toContain('Gói Sanctuary');
  expect(copy.querySelector('tfoot')?.textContent).toContain('1.500.000');
  expect(copy.querySelector('button, dialog')).toBeNull();
  expect(host.querySelector('.invoice-print-root')).toBeNull();
  expect(host.querySelector('dialog')?.textContent).toContain('Lễ tân Mai');
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('In hóa đơn'))!;
  await act(async () => button.click());
  expect(print).toHaveBeenCalledOnce();
  await act(async () => root.render(null));
  expect(document.querySelector('.invoice-print-root')).toBeNull();
});

it.each([
  ['cash', 'Tiền mặt', 'Cash'],
  ['pos', 'Thẻ / POS', 'Card / POS'],
  ['bank_transfer', 'Chuyển khoản', 'Bank transfer'],
  ['online_wallet', 'Ví điện tử', 'E-wallet'],
] as const)('localizes payment method %s in VI and EN using formatPrice (P2-FE-69, P2-E2E-02)', async (method, viLabel, enLabel) => {
  await act(async () => root.render(<PaymentInvoice
    payment={{ id: 91, memberId: 12, amount: 250000, method, status: 'success', paidAt: '2026-11-25T14:15:00', invoiceNumber: 'INV-91' }}
    memberName="Trần Bình" packageName="Khóa Yoga Sáng" onClose={() => {}}
  />));
  expect(host.textContent).toContain(viLabel);
  expect(host.textContent).toContain('250.000');

  await act(async () => { setLanguage('en'); });
  expect(host.textContent).toContain(enLabel);
  expect(host.textContent).toContain('PAYMENT INVOICE');
  expect(host.textContent).toContain('250,000');
});

it('handles missing optional fields gracefully and invokes onClose when closed (P2-E2E-02)', async () => {
  const close = vi.fn();
  await act(async () => root.render(<PaymentInvoice
    payment={{ id: 92, memberId: 13, memberName: 'Fallback Member', amount: 0, method: 'custom_method', status: 'success', paidAt: '' }}
    memberName="" packageName="Gói Trải Nghiệm" onClose={close}
  />));

  const dialog = host.querySelector('dialog')!;
  expect(dialog.textContent).toContain('Chưa cấp số hóa đơn');
  expect(dialog.textContent).toContain('Chưa có thời gian thanh toán');
  expect(dialog.textContent).toContain('Fallback Member');
  expect(dialog.textContent).toContain('custom_method');
  expect(dialog.textContent).not.toContain('Mã hội viên');
  expect(dialog.textContent).not.toContain('Thu ngân');

  const closeBtn = dialog.querySelector<HTMLButtonElement>('.portal-dialog__close')!;
  await act(async () => closeBtn.click());
  expect(close).toHaveBeenCalledOnce();
});
