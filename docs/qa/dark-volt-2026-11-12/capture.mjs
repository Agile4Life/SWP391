// Usage: node shoot.mjs <outDir> [filterSubstring] [motion]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/Users/trancongtuananh/Documents/GitHub/SWP391_GROUP1/apps/web/');
const { chromium } = require('playwright');

const outDir = process.argv[2];
const filter = process.argv[3] || '';
const motion = process.argv[4] === 'motion' ? 'no-preference' : 'reduce';
fs.mkdirSync(outDir, { recursive: true });
const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080/api/v1';

const ACCOUNTS = {
  member: ['an@demo.sol.vn', 'MEMBER'],
  staff: ['letan@demo.sol.vn', 'STAFF'],
  coach: ['hung@demo.sol.vn', 'COACH'],
  manager: ['manager@demo.sol.vn', 'MANAGER'],
};
const tokens = {};
for (const [key, [email]] of Object.entries(ACCOUNTS)) {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: email, password: 'Demo@12345' }) });
  const body = await res.json();
  if (!body.success) throw new Error(`login ${email}: ${JSON.stringify(body)}`);
  tokens[key] = body.data.token;
}

// [name, role, url, optional state fn(page)]
const click = async (page, sel, opts = {}) => { await page.locator(sel).first().click({ timeout: 4000, ...opts }); await page.waitForTimeout(500); };
const PAGES = [
  ['landing', null, '/'],
  ['login', null, '/login'],
  ['register', null, '/register'],
  ['products', null, '/products'],
  ['swimming', null, '/swimming'],
  ['member-dashboard', 'member', '/member/dashboard'],
  ['member-packages', 'member', '/member/packages'],
  ['member-classes', 'member', '/member/classes'],
  ['member-courts', 'member', '/member/courts'],
  ['member-card', 'member', '/member/card'],
  ['member-orders', 'member', '/member/orders'],
  ['member-explore', 'member', '/member/explore', async (page) => { await page.waitForTimeout(6000); }],
  ['staff-reception', 'staff', '/staff/reception'],
  ['coach-classes', 'coach', '/coach/classes'],
  ['manager-reports', 'manager', '/manager/reports'],
  // open states
  ['state-chat', 'member', '/member/dashboard', async (page) => { await click(page, '.chat-widget__trigger'); await page.waitForTimeout(1500); }],
  ['state-avatar-menu', 'member', '/member/dashboard', async (page) => { await click(page, '.portal-avatar'); }],
  ['state-notifications', 'member', '/member/dashboard', async (page) => { await click(page, '.member-notification-bell'); await page.waitForTimeout(800); }],
  ['state-datepicker', 'member', '/member/courts', async (page) => { await click(page, '.luxury-datepicker-trigger'); }],
  ['state-timepicker', 'manager', '/manager/catalogs', async (page) => { await click(page, '.portal-tab:has-text("Phòng tập")'); await click(page, 'button:has-text("Chỉnh sửa")'); await click(page, '.luxury-timepicker-trigger'); }],
  ['state-select', 'member', '/member/profile', async (page) => { await click(page, '.ui-select__trigger'); }],
  ['state-modal', 'member', '/member/dashboard', async (page) => { await click(page, '.portal-avatar'); await click(page, '.portal-avatar-dropdown button:has-text("Đăng xuất"), .portal-avatar-dropdown button:has-text("Sign out"), .portal-avatar-dropdown button:has-text("Log out")'); await page.waitForTimeout(500); }],
  ['state-nav-hover', 'member', '/member/dashboard', async (page) => { await page.hover('.app-sidebar'); await page.waitForTimeout(900); }],
  ['state-tabs', 'member', '/member/classes', async (page) => { await page.waitForTimeout(300); }],
  ['state-focus', 'member', '/member/dashboard', async (page) => { await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(300); }],
];

const THEMES = ['light', 'dark'];
const VPS = { d1440: { width: 1440, height: 900 }, m390: { width: 390, height: 844 } };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
for (const theme of THEMES) {
  for (const [vpName, vp] of Object.entries(VPS)) {
    for (const [name, role, url, state] of PAGES) {
      const file = `${theme}-${vpName}-${name}.png`;
      if (filter && !filter.split(',').some(f => file.includes(f))) continue;
      if (name === 'state-nav-hover' && vpName !== 'd1440') continue;
      const ctx = await browser.newContext({ viewport: vp, reducedMotion: motion, deviceScaleFactor: 1, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', isMobile: vpName === 'm390', hasTouch: vpName === 'm390' });
      await ctx.addInitScript(({ theme, role, token, acc }) => {
        try {
          localStorage.setItem('scms_theme', theme);
          if (role) {
            localStorage.setItem('fitcenter_token', token);
            localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: acc[0], name: acc[0], identifier: acc[0], role: acc[1] }));
          }
        } catch { /* ignore */ }
      }, { theme, role, token: role ? tokens[role] : '', acc: role ? ACCOUNTS[role] : [] });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
        if (state) await state(page);
        const full = !name.startsWith('state-') && vpName === 'd1440' && !role;
        if (name === 'landing' && vpName === 'd1440') {
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0, i = 1; y < height; y += 6000, i++) {
            await page.screenshot({ path: path.join(outDir, file.replace('.png', `-p${i}.png`)), fullPage: true, clip: { x: 0, y, width: 1440, height: Math.min(6000, height - y) } });
          }
        } else {
          await page.screenshot({ path: path.join(outDir, file), fullPage: full });
        }
        report.push(`ok ${file}`);
      } catch (error) {
        report.push(`FAIL ${file}: ${String(error).split('\n')[0]}`);
        try { await page.screenshot({ path: path.join(outDir, `FAIL-${file}`) }); } catch { /* ignore */ }
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(report.join('\n'));
