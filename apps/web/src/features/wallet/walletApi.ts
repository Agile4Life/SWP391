import { apiFetch } from '../../shared/api/client';
import type { VnpayCheckout, VnpayTarget } from '../payments/vnpayApi';
import { releaseAbandonedVnpay } from '../payments/vnpaySession';

/** Loại giao dịch ví: nạp qua VNPay, trừ tiền thanh toán, hoàn tiền (hoặc loại khác từ backend). */
export type WalletTransactionType = 'TOPUP_VNPAY' | 'PAYMENT_DEBIT' | 'REFUND_CREDIT' | string;

/** Một giao dịch ví: loại, số tiền, số dư sau giao dịch, đối tượng tham chiếu, mô tả và thời điểm. */
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

/** Thông tin ví: số dư, lần cập nhật cuối và lịch sử giao dịch. */
export interface WalletDto {
  balance: number;
  updatedAt: string;
  transactions: WalletTransactionDto[];
}

/** Lấy ví của hội viên đang đăng nhập. */
export function getMyWallet(): Promise<WalletDto> {
  return apiFetch<WalletDto>('/wallet/my');
}

/** Tạo phiên nạp tiền ví qua VNPay (hủy trước phiên VNPay bỏ dở nếu có). */
export async function topupWalletVnpay(amount: number): Promise<VnpayCheckout> {
  if (typeof releaseAbandonedVnpay === 'function') await releaseAbandonedVnpay();
  return apiFetch<VnpayCheckout>('/wallet/topup/vnpay', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

/** Thanh toán một khoản bằng số dư ví (hủy trước phiên VNPay bỏ dở nếu có). */
export async function payWithWallet(target: VnpayTarget): Promise<WalletDto> {
  if (typeof releaseAbandonedVnpay === 'function') await releaseAbandonedVnpay();
  return apiFetch<WalletDto>('/wallet/pay', {
    method: 'POST',
    body: JSON.stringify(target),
  });
}

/** Gom các hàm API ví thành một object để import tiện. */
export const walletApi = {
  getMyWallet,
  topupWalletVnpay,
  payWithWallet,
};
