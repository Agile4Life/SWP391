// Run with the local Vite server and playwright-core available via NODE_PATH.
// All API requests use fixtures; no membership data is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const periods = Array.from({ length: 9 }, (_, i) => ({
      id: i + 2, memberId: 1, packageId: 1, packageName: 'The Essential',
      previousSubscriptionId: i + 1, status: 'active',
      startDate: `2099-${String(Math.max(1, i - 1)).padStart(2, '0')}-18`,
      endDate: `2099-${String(Math.max(2, i)).padStart(2, '0')}-18`,
      createdAt: '2026-10-23T00:00:00Z', qrCode: null,
    }));
    const fixtures = {
      '/packages': [{ id: 1, name: 'The Essential', price: 500000, durationDays: 30, classCreditLimit: 12, status: 'active', description: 'Gói tập tháng' }],
      '/memberships/subscriptions/my': null,
      '/memberships/subscriptions/history': periods,
      '/memberships/cancellations/my': [], '/payments/my': [],
    };
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: fixtures[path] ?? [] }) });
    });
    await page.addInitScript(() => {
      localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '1', identifier: 'review', name: 'Nguyễn An', role: 'MEMBER' }));
      localStorage.setItem('fitcenter_token', 'review-only');
    });
    const output = 'docs/ui-review/portal-membership-periods';
    fs.mkdirSync(output, { recursive: true });
    for (const width of [390, 768, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${process.env.PUBLIC_UI_URL || 'http://localhost:5173'}/member/packages`);
      const card = page.getByRole('region', { name: 'Các kỳ đã thanh toán tiếp theo' });
      await card.waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await card.getByRole('listitem').count(), 9, 'preserve all periods, including matching dates');
      const layout = await card.evaluate(el => {
        const dates = el.querySelector('dd');
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          clipped: el.scrollWidth > el.clientWidth,
          dateColor: getComputedStyle(dates).color,
          background: getComputedStyle(el).backgroundColor,
        };
      });
      assert.equal(layout.overflow, false, 'document overflows');
      assert.equal(layout.clipped, false, 'card content overflows');
      assert.equal(layout.dateColor, 'rgb(250, 249, 246)');
      assert.equal(layout.background, 'rgb(41, 41, 41)');
      if ([390, 1440].includes(width)) await card.screenshot({ path: `${output}/periods-${width}.png`, style: '.app-topbar { visibility: hidden !important; }' });
      console.log(`PASS nine paid periods at ${width}px`);
    }
    assert.deepEqual(errors, [], 'browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
