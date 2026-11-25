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
  // Biến/hàm phụ để ghi lại kết quả trong kiểm thử.
  const onReleased = (e: Event) => events.push((e as CustomEvent<{ reference: string }>).detail.reference);
  window.addEventListener('vnpay-attempt-released', onReleased);

  const released = await releaseAbandonedVnpay();
  window.removeEventListener('vnpay-attempt-released', onReleased);

  expect(released).toBe(true);
  expect(client.apiFetch).toHaveBeenCalledWith('/payments/vnpay/transactions/TXN999/cancel', { method: 'POST' });
  expect(events).toEqual(['TXN999']);

  // Các lần gọi tiếp theo không làm gì vì mã tham chiếu đang hoạt động đã được xóa.
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

it('P1-FE-30: preserves ACTIVE_VNPAY_KEY when unauthenticated or on transient 5xx/network error, and clears on 404/409/success', async () => {
  rememberActiveVnpay('TXN500');
  window.localStorage.removeItem('fitcenter_token');
  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(window.localStorage.getItem('scms_active_vnpay_ref')).toBe('TXN500');

  window.localStorage.setItem('fitcenter_token', 'test-member-jwt');
  vi.mocked(client.apiFetch).mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 503 }));
  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(window.localStorage.getItem('scms_active_vnpay_ref')).toBe('TXN500');

  vi.mocked(client.apiFetch).mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
  expect(await releaseAbandonedVnpay()).toBe(false);
  expect(window.localStorage.getItem('scms_active_vnpay_ref')).toBeNull();
});

it('P2-FE-50: navigateToVnpay rejects untrusted URL with bilingual error translation', () => {
  try {
    navigateToVnpay('https://evil.example.com/pay');
    expect.unreachable();
  } catch (err) {
    expect((err as Error & { translation?: { vi: string; en: string } }).translation).toEqual({
      vi: 'Địa chỉ VNPay không hợp lệ.',
      en: 'Invalid VNPay payment URL.',
    });
  }
});
