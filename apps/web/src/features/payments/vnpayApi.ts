import { apiFetch } from '../../shared/api/client';
import {
  cancelVnpayTarget,
  cancelVnpayTransaction,
  clearActiveVnpay,
  releaseAbandonedVnpay,
  rememberActiveVnpay,
} from './vnpaySession';

export type VnpayTarget = { subscriptionId: number } | { coachBookingId: number } | { courtBookingId: number } | { paymentId: number } | { productOrderId: number };
export interface VnpayCheckout { reference: string; paymentUrl: string; amount: number; expiresAt: string }
export interface VnpayStatus { reference: string; paymentId: number; subscriptionId: number | null; amount: number; status: 'pending' | 'success' | 'failed' | 'refunded'; expiresAt: string; destination: string }

export {
  cancelVnpayTarget,
  cancelVnpayTransaction,
  clearActiveVnpay,
  releaseAbandonedVnpay,
  rememberActiveVnpay,
};

export async function createVnpayCheckout(target: VnpayTarget): Promise<VnpayCheckout> {
  await releaseAbandonedVnpay();
  return apiFetch<VnpayCheckout>('/payments/vnpay/checkout', { method: 'POST', body: JSON.stringify(target) });
}

export const getVnpayStatus = (reference: string) =>
  apiFetch<VnpayStatus>(`/payments/vnpay/transactions/${encodeURIComponent(reference)}`);

export const verifyVnpayReturn = (params: Record<string, string>) =>
  apiFetch<VnpayStatus>('/payments/vnpay/verify-return', { method: 'POST', body: JSON.stringify(params) });

export function navigateToVnpay(paymentUrl: string) {
  const url = new URL(paymentUrl);
  if (url.origin !== 'https://sandbox.vnpayment.vn' || url.pathname !== '/paymentv2/vpcpay.html') {
    throw new Error('Địa chỉ VNPay không hợp lệ.');
  }
  const txnRef = url.searchParams.get('vnp_TxnRef');
  if (txnRef) rememberActiveVnpay(txnRef);
  window.location.assign(url.href);
}
