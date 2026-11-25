import { apiFetch } from '../../shared/api/client';
import { sourceMessage } from '../../shared/i18n';
import {
  cancelVnpayTarget,
  cancelVnpayTransaction,
  clearActiveVnpay,
  releaseAbandonedVnpay,
  rememberActiveVnpay,
} from './vnpaySession';

/** Đối tượng cần thanh toán: gói tập, buổi PT hoặc một payment. */
export type VnpayTarget = { subscriptionId: number } | { coachBookingId: number } | { paymentId: number };
/** Phiên thanh toán VNPay: mã tham chiếu, link cổng, số tiền và hạn. */
export interface VnpayCheckout { reference: string; paymentUrl: string; amount: number; expiresAt: string }
/** Trạng thái một giao dịch VNPay. */
export interface VnpayStatus { reference: string; paymentId: number; subscriptionId: number | null; amount: number; status: 'pending' | 'success' | 'failed' | 'refunded'; expiresAt: string; destination: string }

export {
  cancelVnpayTarget,
  cancelVnpayTransaction,
  clearActiveVnpay,
  releaseAbandonedVnpay,
  rememberActiveVnpay,
};

/** Tạo phiên thanh toán VNPay (hủy phiên bỏ dở trước) cho một đối tượng. */
export async function createVnpayCheckout(target: VnpayTarget): Promise<VnpayCheckout> {
  await releaseAbandonedVnpay();
  return apiFetch<VnpayCheckout>('/payments/vnpay/checkout', { method: 'POST', body: JSON.stringify(target) });
}

/** Lấy trạng thái giao dịch theo mã tham chiếu. */
export const getVnpayStatus = (reference: string) =>
  apiFetch<VnpayStatus>(`/payments/vnpay/transactions/${encodeURIComponent(reference)}`);

/** Gửi tham số VNPay trả về để backend xác minh chữ ký và cập nhật giao dịch. */
export const verifyVnpayReturn = (params: Record<string, string>) =>
  apiFetch<VnpayStatus>('/payments/vnpay/verify-return', { method: 'POST', body: JSON.stringify(params) });

/** Chuyển trình duyệt sang cổng VNPay sandbox sau khi kiểm tra đúng domain và đường dẫn; ghi nhớ phiên đang chờ. */
export function navigateToVnpay(paymentUrl: string) {
  const url = new URL(paymentUrl);
  if (url.origin !== 'https://sandbox.vnpayment.vn' || url.pathname !== '/paymentv2/vpcpay.html') {
    throw Object.assign(new Error('Địa chỉ VNPay không hợp lệ.'), {
      translation: sourceMessage('Địa chỉ VNPay không hợp lệ.', 'Invalid VNPay payment URL.'),
    });
  }
  const txnRef = url.searchParams.get('vnp_TxnRef');
  if (txnRef) rememberActiveVnpay(txnRef);
  window.location.assign(url.href);
}
