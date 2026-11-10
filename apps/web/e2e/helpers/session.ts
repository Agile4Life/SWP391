import type { Browser } from '@playwright/test';
import { apiLogin, apiWith, createActiveMember } from './api';

export const WEB_ORIGIN = 'http://localhost:4173';

export function storageStateFor(username: string, token: string, role: 'MEMBER' | 'STAFF' | 'COACH' | 'MANAGER' | 'ADMIN' = 'MEMBER') {
  return {
    cookies: [],
    origins: [{
      origin: WEB_ORIGIN,
      localStorage: [
        { name: 'fitcenter_token', value: token },
        { name: 'fitcenter_auth_session', value: JSON.stringify({ id: username, name: username, identifier: username, role }) },
        { name: 'scms_lang', value: 'vi' },
      ],
    }],
  };
}

/** Hội viên mới (đã kích hoạt, chưa có gói) + token + id + nạp ví tùy chọn. */
export async function newMember(options: { topup?: number; prefix?: string } = {}) {
  const m = await createActiveMember(options.prefix ?? 'e2e');
  const session = await apiLogin(m.username, m.password);
  const profile = await apiWith(session.token, 'GET', '/profile');
  const id = Number((profile.data as any)?.userId);
  if (options.topup) {
    const { api } = await import('./api');
    const res = await api('staff', 'POST', `/wallet/members/${id}/topup`, { amount: options.topup, paymentMethod: 'cash', note: 'e2e' });
    if (res.status >= 300) throw new Error(`topup failed ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...m, token: session.token, id };
}

export async function contextFor(browser: Browser, m: { username: string; token: string }, role: 'MEMBER' | 'STAFF' | 'COACH' | 'MANAGER' | 'ADMIN' = 'MEMBER') {
  return browser.newContext({ storageState: storageStateFor(m.username, m.token, role) });
}

export const PACKAGES = { SILVER: 2, GOLD: 3, PLATINUM: 4, SILVER_3M: 5, GOLD_3M: 6, PLATINUM_3M: 7 } as const;

/** Hội viên mới đã qua KYC và đã được lễ tân thu tiền mặt cho gói `packageId` (gói đang hoạt động). Mỗi test dùng một hội viên riêng. */
export async function memberWithPlan(packageId: number, price: number, options: { topup?: number } = {}) {
  const { createMemberWithKycPending, approveKyc, api } = await import('./api');
  const m = await createMemberWithKycPending('e2eplan');
  const ok = await approveKyc(m.id);
  if (ok.status >= 300) throw new Error(`approve kyc ${ok.status}`);
  const sub = await apiWith(m.token, 'POST', '/memberships/subscriptions', { packageId });
  if (sub.status >= 300) throw new Error(`subscribe ${sub.status} ${JSON.stringify(sub.body)}`);
  const pay = await api('staff', 'POST', '/payments/process', { memberId: m.id, subscriptionId: (sub.data as any).id, amount: price, method: 'cash', note: 'e2e' });
  if (pay.status >= 300) throw new Error(`pay ${pay.status} ${JSON.stringify(pay.body)}`);
  if (options.topup) await api('staff', 'POST', `/wallet/members/${m.id}/topup`, { amount: options.topup, paymentMethod: 'cash', note: 'e2e' });
  return m;
}
