import { z } from 'zod';
import { homePath, type UserSession } from '../api/client';

const packageIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const KEY = 'scms_purchase_return';
export function selectedPackageId(search: string): number | null {
  const result = packageIdSchema.safeParse(new URLSearchParams(search).get('packageId'));
  return result.success ? result.data : null;
}

function purchaseReturnPath(search: string): string | null {
  const target = new URLSearchParams(search).get('returnTo');
  if (!target || !target.startsWith('/member/packages')) return null;
  const url = new URL(target, 'https://scms.invalid');
  if (url.origin !== 'https://scms.invalid' || url.pathname !== '/member/packages') return null;
  const id = selectedPackageId(url.search);
  if (url.searchParams.has('packageId') && id === null) return null;
  return '/member/packages' + (id ? `?packageId=${id}` : '');
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
