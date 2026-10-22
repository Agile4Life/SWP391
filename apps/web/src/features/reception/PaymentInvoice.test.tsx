import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PaymentInvoice } from './PaymentInvoice';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
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
