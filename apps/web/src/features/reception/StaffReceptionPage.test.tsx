import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffReceptionPage } from './StaffReceptionPage';

const api = vi.hoisted(() => ({
  lookupMembers: vi.fn(), getPendingSubscriptions: vi.fn(), getPendingHoldRequests: vi.fn(),
  getActivePackages: vi.fn(), getRenewalCandidates: vi.fn(), createRenewal: vi.fn(), processPayment: vi.fn(),
}));
vi.mock('./receptionApi', () => ({ receptionApi: api, maskCitizenId: () => '—' }));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: () => ({ role: 'STAFF' }) }));
vi.mock('../../shared/ui/toast', () => ({ toast: vi.fn() }));
vi.mock('./PaymentInvoice', () => ({ PaymentInvoice: () => <div>Hóa đơn thực</div> }));

let root: Root;
let host: HTMLDivElement;
const member = { userId: 10, membershipCode: 'MB-10', fullName: 'An', email: 'an@example.test', phone: '1234', status: 'ACTIVE' };
const pkg = { id: 2, name: 'Gold', price: 200, durationDays: 30, status: 'active' };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  api.lookupMembers.mockResolvedValue([member]);
  api.getPendingSubscriptions.mockResolvedValue([]);
  api.getPendingHoldRequests.mockResolvedValue([]);
  api.getActivePackages.mockResolvedValue([pkg]);
  api.getRenewalCandidates.mockResolvedValue([]);
  api.processPayment.mockResolvedValue({ id: 42, memberId: 10, amount: 200, method: 'pos', status: 'success', paidAt: '2026-10-01T10:00:00', invoiceNumber: 'INV-42' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function selectMember() {
  await act(async () => root.render(<StaffReceptionPage />));
  const input = host.querySelector('input[placeholder^="Nhập Số điện thoại"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '1234');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.lookupMembers).toHaveBeenCalledWith('1234');
}

async function chooseAndPay(value: string) {
  const select = host.querySelector('#pos-package')!.parentElement!.querySelector('select') as HTMLSelectElement;
  expect(Array.from(select.options).map((option) => option.value)).toContain(value);
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => select.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

it('sells an active package at the counter for a member without a pending order', async () => {
  await selectMember();
  await chooseAndPay('buy:2');
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 10, packageId: 2, amount: 200 }));
  expect(api.createRenewal).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Hóa đơn thực');
});

it('creates a linked renewal before collecting payment', async () => {
  const previous = { id: 5, memberId: 10, packageId: 2, packageName: 'Gold', startDate: '2026-09-01', endDate: '2026-09-30', status: 'expired', createdAt: '2026-09-01' };
  api.getRenewalCandidates.mockResolvedValue([previous]);
  api.createRenewal.mockResolvedValue({ ...previous, id: 6, status: 'pending_payment' });
  await selectMember();
  await chooseAndPay('renew:5');
  expect(api.createRenewal).toHaveBeenCalledWith(10, 5);
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ memberId: 10, subscriptionId: 6, packageId: 2, amount: 200 }));
});

it('keeps an existing pending order fixed to its selected package', async () => {
  api.getPendingSubscriptions.mockResolvedValue([{ id: 9, memberId: 10, membershipCode: 'MB-10', memberName: 'An',
    memberEmail: 'an@example.test', memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30,
    packagePrice: 200, startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01' }]);
  await selectMember();
  const field = host.querySelector('#pos-package') as HTMLInputElement;
  expect(field.tagName).toBe('INPUT');
  expect(field.disabled).toBe(true);
  expect(field.value).toContain('Gold');
  await act(async () => field.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.processPayment).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 9, packageId: 2, amount: 200 }));
});

it('keeps the created renewal pending when payment fails', async () => {
  const previous = { id: 5, memberId: 10, packageId: 2, packageName: 'Gold', startDate: '2026-09-01', endDate: '2026-09-30', status: 'expired', createdAt: '2026-09-01' };
  api.getRenewalCandidates.mockResolvedValue([previous]);
  api.createRenewal.mockResolvedValue({ ...previous, id: 6, status: 'pending_payment' });
  api.processPayment.mockRejectedValue(new Error('payment failed'));
  api.getPendingSubscriptions.mockResolvedValueOnce([]).mockResolvedValue([{ id: 6, memberId: 10, membershipCode: 'MB-10', memberName: 'An',
    memberEmail: 'an@example.test', memberPhone: '1234', packageId: 2, packageName: 'Gold', durationDays: 30,
    packagePrice: 200, startDate: '2026-10-01', endDate: '2026-10-30', status: 'pending_payment', createdAt: '2026-10-01' }]);
  await selectMember();
  await chooseAndPay('renew:5');
  expect((host.querySelector('#pos-package') as HTMLInputElement).value).toContain('Yêu cầu #6');
  expect(host.textContent).not.toContain('Hóa đơn thực');
});
