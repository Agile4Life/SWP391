import { apiFetch, TOKEN_STORAGE_KEY } from '../../shared/api/client';
import type { VnpayStatus, VnpayTarget } from './vnpayApi';

const ACTIVE_VNPAY_KEY = 'scms_active_vnpay_ref';
let inFlightRelease: Promise<boolean> | null = null;

/** Ghi nhớ mã tham chiếu giao dịch VNPay đang mở vào localStorage (bỏ qua lỗi storage). */
export function rememberActiveVnpay(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(ACTIVE_VNPAY_KEY, trimmed);
  } catch {
    // Bỏ qua lỗi quyền riêng tư hoặc đầy dung lượng lưu trữ
  }
}

/** Xóa mã giao dịch đang mở (nếu truyền mã thì chỉ xóa khi khớp). */
export function clearActiveVnpay(reference?: string) {
  try {
    if (!reference) {
      window.localStorage.removeItem(ACTIVE_VNPAY_KEY);
      return;
    }
    const stored = window.localStorage.getItem(ACTIVE_VNPAY_KEY);
    if (!stored || stored === reference.trim()) {
      window.localStorage.removeItem(ACTIVE_VNPAY_KEY);
    }
  } catch {
    // Bỏ qua lỗi lưu trữ trình duyệt
  }
}

/** Hủy một giao dịch VNPay theo mã tham chiếu. */
export const cancelVnpayTransaction = (reference: string) =>
  apiFetch<VnpayStatus>(`/payments/vnpay/transactions/${encodeURIComponent(reference)}/cancel`, { method: 'POST' });

/** Hủy giao dịch VNPay đang chờ của một đối tượng thanh toán. */
export const cancelVnpayTarget = (target: VnpayTarget) =>
  apiFetch<void>('/payments/vnpay/cancel', { method: 'POST', body: JSON.stringify(target) });

/**
 * Hủy giao dịch bỏ dở còn lưu (một lượt tại một thời điểm), bỏ qua ở trang kết quả hoặc khi chưa đăng nhập; trả
 * true nếu hủy được.
 */
export function releaseAbandonedVnpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.location.pathname.startsWith('/member/payments/vnpay/return')) {
    return Promise.resolve(false);
  }
  if (inFlightRelease) return inFlightRelease;
  let stored: string | null = null;
  let hasToken = false;
  try {
    stored = window.localStorage.getItem(ACTIVE_VNPAY_KEY)?.trim() || null;
    hasToken = Boolean(window.localStorage.getItem(TOKEN_STORAGE_KEY));
    if (stored) window.localStorage.removeItem(ACTIVE_VNPAY_KEY);
  } catch {
    // Bộ nhớ trình duyệt không khả dụng: khi không có mã tham chiếu hoặc token đã lưu, điều kiện bên dưới sẽ trả về false.
  }
  if (!stored || !hasToken) return Promise.resolve(false);
  const reference = stored;
  const task = cancelVnpayTransaction(reference)
    .then(() => {
      window.dispatchEvent(new CustomEvent('vnpay-attempt-released', { detail: { reference } }));
      return true;
    })
    .catch(() => false)
    .finally(() => {
      if (inFlightRelease === task) inFlightRelease = null;
    });
  inFlightRelease = task;
  return task;
}
