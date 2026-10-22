// Requires the local Vite server and Playwright through NODE_PATH.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.PUBLIC_UI_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname, '../docs/ui-review/fitness-reference');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/accounts.google.com/gsi/**', (route) => route.fulfill({ body: '', contentType: 'text/javascript' }));
  try {
    await page.goto(base);
    assert.notEqual(await page.locator('.fit-hero-athlete').evaluate((image) => getComputedStyle(image).animationName), 'none', 'Hero athlete must have an entrance animation');
    assert.equal(await page.locator('.fit-motion-run').count(), 0, 'Page must keep vertical document flow');
    await page.waitForFunction(() => document.querySelector('.fit-plan')?.classList.contains('fit-reveal-ready'));
    const plan = page.locator('.fit-plan').first();
    assert.equal(await plan.evaluate((element) => getComputedStyle(element).opacity), '0', 'Offscreen cards must wait for viewport entry');
    assert.match(await plan.evaluate((element) => getComputedStyle(element).transitionProperty), /opacity/, 'Card entrances must transition opacity rather than appear instantly');
    await plan.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.fit-plan').classList.contains('is-visible'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.fit-plan')).opacity === '1');
    await page.screenshot({ path: path.join(output, 'animation-pricing-desktop.png') });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    assert.equal(await plan.evaluate((element) => element.classList.contains('is-visible')), true, 'Reveals must play once without hiding content when scrolling back');
    const beforeWheel = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 450);
    await page.waitForFunction((before) => scrollY > before + 100, beforeWheel);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS hero animation, viewport reveals, play-once behavior and native vertical scrolling');

    await page.locator('.fit-nav').getByRole('link', { name: 'Huấn luyện viên' }).click();
    await page.getByRole('button', { name: 'Nhóm huấn luyện 2' }).click();
    await page.getByRole('heading', { name: 'Personal coach' }).waitFor();
    await page.getByRole('button', { name: 'Free weights' }).click();
    await page.getByRole('heading', { name: 'Tập trung vào từng chuyển động.' }).waitFor();
    console.log('PASS navigation, trainer carousel and gallery work with animation enabled');

    await page.goto(`${base}/login`);
    await page.waitForFunction(() => document.querySelector('.fit-auth-form')?.classList.contains('is-visible'));
    await page.locator('#login-identifier').fill('review_member');
    await page.locator('#login-password').fill('test-password');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
    console.log('PASS authentication entrance preserves form interaction');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.fit-auth-form').evaluate((element) => getComputedStyle(element).opacity), '1');
    await page.goto(base);
    assert.equal(await page.locator('.fit-hero-athlete').evaluate((image) => getComputedStyle(image).animationName), 'none');
    assert.equal(await page.locator('.fit-plan').first().evaluate((element) => getComputedStyle(element).opacity), '1');
    assert.equal(await page.locator('.fit-reveal-ready').count(), 0);
    console.log('PASS live reduced-motion preference and static readable fallback');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator('#packages').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.fit-plan')?.classList.contains('is-visible'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS mobile component reveals and no uncaught browser errors');

    await page.addInitScript(() => Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }));
    await page.goto(base);
    assert.equal(await page.locator('.fit-plan').first().evaluate((element) => getComputedStyle(element).opacity), '1');
    assert.equal(await page.locator('.fit-reveal-ready').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS readable fallback when IntersectionObserver is unavailable');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
