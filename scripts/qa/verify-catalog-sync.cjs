// NODE_PATH: playwright-core; CHROME_PATH: installed Chromium executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const fixture = require('./public-catalog-fixture.cjs');
const base = process.env.PUBLIC_UI_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const output = 'docs/ui-review/catalog-sync'; fs.mkdirSync(output, { recursive: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let catalog = structuredClone(fixture), mode = 'success';
  await page.route('**/accounts.google.com/gsi/**', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/public/catalog') ? catalog : path.endsWith('/packages') ? catalog.packages : path.endsWith('/subscriptions/my') ? null : [];
    return route.fulfill({ status: mode === 'error' ? 503 : 200, json: { success: mode !== 'error', data } });
  });
  try {
    for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(base);
      await page.locator('.fit-plan').first().waitFor();
      assert.ok((await page.locator('.fit-plan').first().innerText()).includes('789.000'));
      assert.equal(await page.locator('.fit-trainer-card').count(), 2);
      assert.equal(await page.locator('.fit-schedule-card').count(), 6);
      assert.equal(await page.locator('.fit-nav a').first().evaluate(el => getComputedStyle(el).fontSize), '15px');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width}`);
      if ([390, 1440].includes(width)) {
        for (const id of ['packages', 'trainers', 'schedule']) {
          const section = page.locator(`#${id}`); await section.scrollIntoViewIfNeeded();
          await section.screenshot({ path: `${output}/${id}-${width}.png` });
        }
      }
    }
    await page.goto(`${base}/trainers/1`);
    await page.getByRole('heading', { level: 1 }).filter({ hasText: fixture.coaches[0].name }).waitFor();
    assert.equal(await page.locator('.fit-schedule-card').count(), 2);
    await page.goto(`${base}/trainers/missing`);
    await page.getByRole('heading', { name: 'Không tìm thấy huấn luyện viên' }).waitFor();
    // A new price and coach biography reach landing without editing frontend constants.
    catalog.packages[0].price = 899000; catalog.coaches[0].bio = 'Hồ sơ vừa sửa';
    await page.goto(base); await page.locator('.fit-plan').first().filter({ hasText: '899.000' }).waitFor();
    await page.evaluate(() => localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '1', identifier: 'review', name: 'Nguyễn An', role: 'MEMBER' })));
    await page.goto(`${base}/member/packages`);
    await page.getByText('899.000', { exact: false }).first().waitFor();
    await page.evaluate(() => localStorage.clear());
    catalog = { packages: [], coaches: [], sessions: [] }; await page.goto(base);
    await page.getByText('Chưa có gói tập phù hợp.').waitFor();
    await page.getByText('Chưa có huấn luyện viên đang hoạt động.').waitFor();
    await page.getByText('Chưa có lịch lớp phù hợp trong 7 ngày tới.').waitFor();
    mode = 'error'; await page.reload(); await page.getByRole('button', { name: 'Thử lại' }).first().waitFor();
    assert.equal(await page.locator('.fit-plan').count(), 0);
    mode = 'success'; catalog = structuredClone(fixture);
    await page.getByRole('button', { name: 'Thử lại' }).first().click(); await page.locator('.fit-plan').first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS landing/portal price parity, actual coaches and schedules, seven widths, coach details, empty/error/retry states');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
