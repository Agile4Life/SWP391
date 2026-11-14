import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as client from '../../shared/api/client';
import {
  clearActiveVnpay,
  navigateToVnpay,
  releaseAbandonedVnpay,
  rememberActiveVnpay,
} from './vnpayApi';

vi.mock('../../shared/api/client', () => ({
  apiFetch: vi.fn(),
  TOKEN_STORAGE_KEY: 'fitcenter_token',
}));

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('fitcenter_token', 'test-member-jwt');
  window.history.replaceState({}, '', '/member/packages');
  vi.clearAllMocks();
});

afterEach(() => {
  window.localStorage.clear();
});

it('records vnp_TxnRef on navigateToVnpay and releases it when returning outside vnpay return page', async () => {
  const assignSpy = vi.fn();
  vi.stubGlobal('location', {
    ...window.location,
    pathname: '/member/packages',
    assign: assignSpy,
  });
  vi.mocked(client.apiFetch).mockResolvedValue({
    reference: 'TXN999',
    paymentId: 1,
    subscriptionId: 2,
    amount: 500000,
    status: 'failed',
    expiresAt: '2026-11-03T12:15:00',
    destination: '/member/packages',
  });

  navigateToVnpay('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=TXN999&vnp_Amount=50000000');
  expect(assignSpy).toHaveBeenCalledTimes(1);

  const events: string[] = [];
  const onReleased = (e: Event) => events.push((e as CustomEvent<{ reference: string }>).detail.reference);
  window.addEventListener('vnpay-attempt-released', onReleased);

  const released = await releaseAbandonedVnpay();
  window.removeEventListener('vnpay-attempt-released', onReleased);

  expect(released).toBe(true);
  expect(client.apiFetch).toHaveBeenCalledWith('/payments/vnpay/transactions/TXN999/cancel', { method: 'POST' });
  expect(events).toEqual(['TXN999']);

  // Subsequent calls are no-ops because the active reference was cleared.
  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(client.apiFetch).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it('never cancels while on /member/payments/vnpay/return and clearActiveVnpay prevents later cancel', async () => {
  rememberActiveVnpay('TXN777');
  window.history.replaceState({}, '', '/member/payments/vnpay/return?vnp_TxnRef=TXN777');

  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(client.apiFetch).not.toHaveBeenCalled();

  clearActiveVnpay('TXN777');
  window.history.replaceState({}, '', '/member/packages');
  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(client.apiFetch).not.toHaveBeenCalled();
});
