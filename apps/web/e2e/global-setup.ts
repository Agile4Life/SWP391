import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ACCOUNTS, API_URL, authFile, type RoleKey } from './helpers/accounts';
import { apiLogin } from './helpers/api';

/** Đợi API sẵn sàng, đăng nhập một lần cho mỗi vai trò và lưu storageState để spec không phải qua form đăng nhập (giới hạn 60 req/phút). */
export default async function globalSetup(config: FullConfig) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const res = await fetch(`${API_URL}/api/v1/health`);
      if (res.ok) break;
    } catch { /* API chưa lên */ }
    if (Date.now() > deadline) throw new Error(`API e2e không phản hồi tại ${API_URL}. Chạy: npm run e2e:stack:up`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  mkdirSync('e2e/.auth', { recursive: true });
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  for (const key of Object.keys(ACCOUNTS) as RoleKey[]) {
    const account = ACCOUNTS[key];
    const session = await apiLogin(account.username, account.password);
    const roleForUi = account.role;
    const context = await browser.newContext({ baseURL });
    await context.addInitScript(
      ([token, user]) => {
        localStorage.setItem('fitcenter_token', token);
        localStorage.setItem('fitcenter_auth_session', user);
        localStorage.setItem('scms_lang', 'vi');
      },
      [session.token, JSON.stringify({ id: session.username, name: session.username, identifier: session.username, role: roleForUi })],
    );
    const page = await context.newPage();
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await context.storageState({ path: authFile(key) });
    await context.close();
  }
  await browser.close();
}
