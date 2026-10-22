// Run with Playwright available through NODE_PATH, with the local Vite server running.
// UI checks use intercepted auth responses and never create real accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.PUBLIC_UI_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname, '../docs/ui-review/fitness-reference');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/accounts.google.com/gsi/**', (route) => route.fulfill({ body: '', contentType: 'text/javascript' }));
  const check = (label) => console.log(`PASS ${label}`);
  try {
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.fit-hero-athlete').evaluate((image) => image.decode());
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.fit-service').count(), 3);
    await page.getByRole('button', { name: 'Nhóm huấn luyện 2' }).click();
    await page.getByRole('heading', { name: 'Personal coach' }).waitFor();
    await page.getByRole('button', { name: 'Nhóm huấn luyện 1' }).click();
    await page.getByRole('button', { name: 'Free weights' }).click();
    await page.getByRole('heading', { name: 'Tập trung vào từng chuyển động.' }).waitFor();
    await page.getByRole('button', { name: 'Strength floor' }).click();
    await page.getByRole('button', { name: 'Đồng hành dài hạn' }).click();
    assert.equal(await page.locator('.fit-plan').count(), 2);
    await page.getByRole('button', { name: 'Tất cả gói tập' }).click();
    assert.equal(await page.locator('.fit-plan').count(), 3);
    check('trainer navigation, gallery switch and pricing filter');

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base);
      await page.locator('.fit-hero-athlete').evaluate((image) => image.decode());
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `Landing overflows at ${width}px by ${overflow}px`);
      assert.equal(await page.locator('img').evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).length), 0);
      if (width === 390 || width === 1440) {
        const name = width === 390 ? 'mobile' : 'desktop';
        await page.screenshot({ path: path.join(output, `landing-${name}.png`), fullPage: true });
        await page.locator('.fit-services').screenshot({ path: path.join(output, `services-${name}.png`) });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `hero-${name}.png`) });
      }
      if (width === 390) {
        await page.getByRole('button', { name: 'Mở menu' }).click();
        assert.equal(await page.getByRole('button', { name: 'Đóng menu' }).getAttribute('aria-expanded'), 'true');
        await page.locator('.fit-nav').getByRole('link', { name: 'Gói tập' }).click();
        assert.equal(await page.getByRole('button', { name: 'Mở menu' }).getAttribute('aria-expanded'), 'false');
      }
    }
    check('landing: six viewport widths, local images and mobile menu');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/login`);
    await page.screenshot({ path: path.join(output, 'login-desktop.png'), fullPage: true });
    await page.locator('#login-identifier').fill('review_member');
    await page.locator('#login-password').fill('test-password');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 401, json: { message: 'Thông tin đăng nhập chưa đúng.' } }));
    await page.locator('button[type="submit"]').click();
    await page.getByRole('alert').filter({ hasText: 'Thông tin đăng nhập chưa đúng.' }).waitFor();
    await page.screenshot({ path: path.join(output, 'login-error-desktop.png'), fullPage: true });
    check('login password toggle and API error feedback');

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ['login', 'register']) {
        await page.goto(`${base}/${route}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `${route} overflows at ${width}px`);
        if (width !== 768) await page.screenshot({ path: path.join(output, `${route}-${width === 390 ? 'mobile' : 'desktop'}.png`), fullPage: true });
      }
    }
    check('login and registration: mobile, tablet and desktop layouts');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/register`);
    let createPayload;
    let verifyPayload;
    await page.route('**/api/v1/auth/register', async (route) => {
      createPayload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, data: {} } });
    });
    await page.route('**/api/v1/auth/send-otp', (route) => route.fulfill({ json: { success: true, data: {} } }));
    await page.route('**/api/v1/auth/verify-otp', async (route) => {
      verifyPayload = route.request().postDataJSON();
      await route.fulfill({ status: 400, json: { message: 'Mã OTP không đúng hoặc đã hết hạn.' } });
    });
    await page.locator('#reg-username').fill('review_member');
    await page.locator('#reg-email').fill('review@example.com');
    await page.locator('#reg-password').fill('test-password');
    await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
    await page.getByRole('heading', { name: 'Xác thực OTP' }).waitFor();
    assert.equal(createPayload.username, 'review_member');
    assert.equal(createPayload.email, 'review@example.com');
    assert.equal(await page.getByRole('button', { name: /Gửi lại mã sau/ }).isDisabled(), true);
    await page.screenshot({ path: path.join(output, 'otp-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.screenshot({ path: path.join(output, 'otp-mobile.png'), fullPage: true });
    await page.locator('#otp-code').fill('123456');
    await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT' }).click();
    await page.getByRole('alert').filter({ hasText: 'Mã OTP không đúng' }).waitFor();
    assert.deepEqual(verifyPayload, { target: 'review@example.com', otpCode: '123456' });
    check('registration → OTP, resend cooldown and invalid OTP feedback (mocked API)');

    await page.evaluate(() => localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: 'review', identifier: 'review', name: 'Review Member', role: 'MEMBER' })));
    await page.goto(base);
    assert.equal(await page.locator('.fit-hero-action a').getAttribute('href'), '/member/packages');
    assert.equal(await page.locator('.fit-plan a').first().getAttribute('href'), '/member/packages');
    assert.equal(await page.locator('.fit-header-cta').getAttribute('href'), '/member/dashboard');
    await page.evaluate(() => localStorage.removeItem('fitcenter_auth_session'));
    check('signed-in member CTAs lead to existing portal routes');

    assert.deepEqual(errors, [], 'Browser must have no unhandled JavaScript errors');
    check('no uncaught browser errors');
    fs.writeFileSync(path.join(output, 'browser-verification.json'), JSON.stringify({ status: 'passed', widths: [320, 375, 390, 768, 1024, 1440], auth: 'mocked API; no real accounts created', errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
