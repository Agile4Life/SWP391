import { apiFetch, TOKEN_STORAGE_KEY } from '../../shared/api/client';
import type { VnpayStatus, VnpayTarget } from './vnpayApi';

const ACTIVE_VNPAY_KEY = 'scms_active_vnpay_ref';
let inFlightRelease: Promise<boolean> | null = null;

export function rememberActiveVnpay(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(ACTIVE_VNPAY_KEY, trimmed);
  } catch {
    // Ignore storage privacy/quota errors
  }
}

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
    // Ignore storage errors
  }
}

export const cancelVnpayTransaction = (reference: string) =>
  apiFetch<VnpayStatus>(`/payments/vnpay/transactions/${encodeURIComponent(reference)}/cancel`, { method: 'POST' });

export const cancelVnpayTarget = (target: VnpayTarget) =>
  apiFetch<void>('/payments/vnpay/cancel', { method: 'POST', body: JSON.stringify(target) });

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
    // Storage unavailable: with no stored reference or token the check below returns false.
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
