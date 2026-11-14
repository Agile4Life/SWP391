import { apiFetch } from '../../shared/api/client';
import type { VnpayCheckout, VnpayTarget } from '../payments/vnpayApi';
import { releaseAbandonedVnpay } from '../payments/vnpaySession';

export type WalletTransactionType = 'TOPUP_VNPAY' | 'PAYMENT_DEBIT' | 'REFUND_CREDIT' | string;

export interface WalletTransactionDto {
  id: number;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface WalletDto {
  balance: number;
  updatedAt: string;
  transactions: WalletTransactionDto[];
}

export function getMyWallet(): Promise<WalletDto> {
  return apiFetch<WalletDto>('/wallet/my');
}

export async function topupWalletVnpay(amount: number): Promise<VnpayCheckout> {
  if (typeof releaseAbandonedVnpay === 'function') await releaseAbandonedVnpay();
  return apiFetch<VnpayCheckout>('/wallet/topup/vnpay', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function payWithWallet(target: VnpayTarget): Promise<WalletDto> {
  if (typeof releaseAbandonedVnpay === 'function') await releaseAbandonedVnpay();
  return apiFetch<WalletDto>('/wallet/pay', {
    method: 'POST',
    body: JSON.stringify(target),
  });
}

export const walletApi = {
  getMyWallet,
  topupWalletVnpay,
  payWithWallet,
};
