import { homePath, type UserSession } from '../api/client';

const KEY = 'scms_purchase_return';
export function selectedPackageId(search: string): number | null {
  const raw = new URLSearchParams(search).get('packageId')?.trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

// Chỉ khôi phục ý định mua gói hội viên; URL Shop cũ không còn là đích đăng nhập.
function purchaseReturnPath(search: string): string | null {
  const target = new URLSearchParams(search).get('returnTo');
  if (!target) return null;
  if (target.startsWith('/member/packages')) {
    try {
      const url = new URL(target, 'https://scms.invalid');
      if (url.origin !== 'https://scms.invalid' || url.pathname !== '/member/packages') return null;
      const id = selectedPackageId(url.search);
      if (url.searchParams.has('packageId') && id === null) return null;
      return '/member/packages' + (id ? `?packageId=${id}` : '');
    } catch {
      return null;
    }
  }
  return null;
}

export function purchaseAuthPath(path: '/login' | '/register', search: string): string {
  const target = purchaseReturnPath(search);
  return path + (target ? `?returnTo=${encodeURIComponent(target)}` : '');
}

export function authDestination(role: UserSession['role'], search: string): string {
  if (role !== 'MEMBER') return homePath(role);
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(KEY); } catch { /* URL navigation still works without storage. */ }
  return purchaseReturnPath(search) ?? purchaseReturnPath(`?returnTo=${encodeURIComponent(saved ?? '')}`) ?? homePath(role);
}

export function rememberPurchaseIntent(search: string) {
  const target = purchaseReturnPath(search);
  try { if (target) sessionStorage.setItem(KEY, target); } catch { /* Optional OAuth redirect continuity. */ }
}

export function clearPurchaseIntent() {
  try { sessionStorage.removeItem(KEY); } catch { /* Optional browser storage. */ }
}
