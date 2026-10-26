// UX audit: real catalog/health reads; every browser API request is intercepted.
// Run with playwright-core via NODE_PATH and CHROME_PATH for a local Chrome install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const base = process.env.PUBLIC_UI_URL || 'http://localhost:5173';
const api = process.env.AUDIT_API_URL || 'http://localhost:8080';
const output = path.resolve(process.env.AUDIT_OUTPUT || 'docs/qa/purchase-ux-2026-10-26');
fs.mkdirSync(output, { recursive: true });
const results = [];
const commit = require('node:child_process').execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
let catalog;

function subscription(pkg, status = 'pending_payment', id = 9001) {
  return { id, memberId: 9001, packageId: pkg.id, packageName: pkg.name, previousSubscriptionId: null, startDate: '2026-10-26', endDate: '2026-11-24', status, qrCode: null, createdAt: '2026-10-26T09:00:00' };
}

async function setup(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1440, height: options.height || 900 }, timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: options.motion ? 'no-preference' : 'reduce', isMobile: !!options.mobile, hasTouch: !!options.mobile });
  const state = { packages: structuredClone(catalog.packages), history: [], current: null, payments: [], calls: [], registered: false, failures: {}, ...options.state };
  await context.addInitScript(({ member, theme }) => {
    localStorage.setItem('scms_theme', theme);
    if (member) {
      localStorage.setItem('fitcenter_auth_session', JSON.stringify({ id: '9001', identifier: 'ux_buyer', name: 'Khách kiểm thử', role: 'MEMBER' }));
      localStorage.setItem('fitcenter_token', 'fixture-only');
    }
  }, { member: !!options.member, theme: options.theme || 'light' });
  await context.route('**/accounts.google.com/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await context.route('**/api/v1/**', async route => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace(/^\/api\/v1/, '');
    const method = req.method();
    state.calls.push({ method, endpoint });
    const reply = (data, status = 200, message) => route.fulfill({ status, json: { success: status < 400, data, ...(message ? { message } : {}) } });
    if (state.delayPath === endpoint) await new Promise(r => setTimeout(r, 700));
    if (state.failures[endpoint]) return reply(null, state.failures[endpoint], 'Không thể tải dữ liệu kiểm thử.');
    if (endpoint === '/public/catalog') return reply({ ...catalog, packages: state.packages });
    if (endpoint === '/auth/register') {
      if (state.registered) return reply(null, 409, 'Tên đăng nhập hoặc email đã tồn tại.');
      state.registered = true; return reply(null);
    }
    if (endpoint === '/auth/send-otp') {
      if (state.failOtpOnce) { state.failOtpOnce = false; return reply(null, 503, 'Không gửi được mã OTP. Vui lòng thử lại.'); }
      return reply({});
    }
    if (endpoint === '/auth/verify-otp') return req.postDataJSON().otpCode === '123456' ? reply(null) : reply(null, 400, 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    if (endpoint === '/auth/login') return state.loginError ? reply(null, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.') : reply({ token: 'fixture-only', username: 'ux_buyer', role: 'MEMBER' });
    if (endpoint === '/profile') return reply({ userId: 9001, fullName: 'Khách kiểm thử', email: 'buyer@example.test', membershipCode: 'UX-9001' });
    if (endpoint === '/packages') return reply(state.packages);
    if (endpoint === '/memberships/subscriptions/my') return reply(state.current);
    if (endpoint === '/memberships/subscriptions/history') return reply(state.history);
    if (endpoint === '/memberships/cancellations/my') return reply([]);
    if (endpoint === '/payments/my') return reply(state.payments);
    if (endpoint === '/memberships/subscriptions' && method === 'POST') {
      if (state.createDelay) await new Promise(r => setTimeout(r, state.createDelay));
      if (state.createError) return reply(null, state.createError, state.createError === 409 ? 'Bạn đã có yêu cầu gói tập đang chờ thanh toán.' : 'Không thể tạo yêu cầu. Vui lòng thử lại.');
      const pkg = state.packages.find(p => p.id === req.postDataJSON().packageId);
      const sub = subscription(pkg); state.history.unshift(sub);
      if (state.lostResponse) return route.abort('failed');
      return reply(sub, 201);
    }
    if (/\/subscriptions\/\d+\/cancel$/.test(endpoint)) {
      if (state.cancelError) return reply(null, 409, 'Yêu cầu đã được thanh toán, không thể hủy.');
      const sub = state.history[0]; sub.status = 'cancelled'; return reply(sub);
    }
    if (/\/subscriptions\/\d+\/renew$/.test(endpoint)) {
      const sub = { ...subscription(state.packages[0]), previousSubscriptionId: state.history[0].id };
      state.history.unshift(sub); return reply(sub, 201);
    }
    if (method !== 'GET') return reply(null, 400, `Unexpected fixture write: ${endpoint}`);
    return reply([]);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-10-26T09:00:00+07:00'));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return { context, page, state, errors };
}

async function check(browser, id, title, fn, options = {}) {
  if (process.env.AUDIT_CASE_FILTER && !new RegExp(process.env.AUDIT_CASE_FILTER).test(id)) return;
  const env = await setup(browser, options);
  const notes = [];
  let status = 'PASS', detail = '';
  try { await fn({ ...env, note: x => notes.push(x) }); }
  catch (e) { status = e.code === 'ERR_ASSERTION' ? 'ISSUE' : 'ERROR'; detail = e.message; }
  if (options.capture || status !== 'PASS') {
    try { await env.page.screenshot({ path: path.join(output, `${id}.png`), fullPage: false }); } catch { /* A navigation can close the page. */ }
  }
  results.push({ id, title, status, detail, notes, runtimeErrors: env.errors, requests: env.state.calls });
  console.log(`${status} ${id}: ${title}${detail ? ' — ' + detail.split('\n')[0] : ''}`);
  await env.context.close();
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, api, commit, liveCatalog: catalog.packages, results }, null, 2));
}

const createButtons = page => page.getByRole('button', { name: 'Đăng ký lần đầu', exact: true });
async function packages(page) {
  await page.goto(`${base}/member/packages`);
  await page.locator('.grid-3 article').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
}
async function fillRegister(page, overrides = {}) {
  const values = { username: 'ux_buyer', email: 'buyer@example.test', phone: '', password: 'Buyer123!', ...overrides };
  for (const [key, value] of Object.entries(values)) await page.locator(`#reg-${key}`).fill(value);
}
async function login(page) {
  await page.locator('#login-identifier').fill('ux_buyer');
  await page.locator('#login-password').fill('Buyer123!');
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL('**/member/dashboard');
}
const writes = state => state.calls.filter(c => c.endpoint === '/memberships/subscriptions' && c.method === 'POST').length;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const live = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const health = await live.request.get(`${api}/api/v1/health`);
    assert.equal((await health.json()).status, 'UP');
    const response = await live.request.get(`${api}/api/v1/public/catalog`);
    assert.equal(response.status(), 200);
    catalog = (await response.json()).data;
    await live.route('**/accounts.google.com/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await live.route('**/api/v1/**', route => route.request().method() === 'GET' ? route.continue() : route.abort('blockedbyclient'));
    const livePage = await live.newPage();
    await livePage.goto(`${base}/#packages`);
    await livePage.locator('.fit-plan').first().waitFor();
    assert.equal(await livePage.locator('.fit-plan').count(), catalog.packages.length);
    for (const pkg of catalog.packages) {
      assert.ok((await livePage.locator('.fit-plan').filter({ hasText: pkg.name }).innerText()).includes(new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price)));
    }
    await livePage.locator('#packages').screenshot({ path: path.join(output, 'pricing-live-1440.png') });
    results.push({ id: 'live-catalog', title: 'Real landing UI renders the live public catalog and correct prices', status: 'PASS', detail: '', notes: ['GET requests only; live API.'], runtimeErrors: [], requests: [] });
    await live.close();
    console.log(`LIVE read-only: health UP, ${catalog.packages.length} public packages`);

    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await check(browser, `journey-${width}`, 'New buyer: landing → register → OTP → login → package request', async ({ page, state, note }) => {
        await page.goto(`${base}/#packages`);
        const vip = page.locator('.fit-plan').filter({ hasText: catalog.packages[1].name });
        await vip.waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.ok((await vip.innerText()).includes(new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(catalog.packages[1].price)));
        await page.locator('#packages').screenshot({ path: path.join(output, `pricing-${width}.png`) });
        await vip.getByRole('link', { name: 'Chọn gói tập' }).click();
        assert.ok(page.url().endsWith('/register'));
        note({ selectedPackage: catalog.packages[1].name, registrationURL: page.url() });
        await fillRegister(page);
        await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
        await page.locator('#otp-code').fill('123456');
        await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT' }).click();
        await page.waitForURL('**/login');
        await login(page);
        note({ afterLogin: page.url(), selectedPackageRetained: new URL(page.url()).searchParams.has('packageId') });
        await page.locator('a[href="/member/packages"]:visible').first().click();
        await createButtons(page).first().waitFor();
        const chosen = page.locator('.grid-3 article').filter({ hasText: catalog.packages[1].name });
        await page.locator('.grid-3').screenshot({ path: path.join(output, `portal-catalog-${width}.png`) });
        await chosen.getByRole('button', { name: 'Đăng ký lần đầu' }).click();
        const dialog = page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true });
        await dialog.waitFor();
        assert.ok((await dialog.innerText()).includes('Quầy Lễ Tân'));
        assert.equal(writes(state), 1);
        assert.equal(state.calls.filter(c => c.endpoint === '/payments' && c.method === 'POST').length, 0);
        note({ dialog: await dialog.innerText(), geometry: await dialog.boundingBox(), viewport: { width, height }, activeElementInsideDialog: await dialog.evaluate(el => el.contains(document.activeElement)) });
      }, { width, height, mobile: width < 500, capture: true });
    }

    await check(browser, 'selection-continuity', 'Selected package and purchase intent survive authentication', async ({ page, note }) => {
      await page.goto(`${base}/#packages`);
      await page.locator('.fit-plan').nth(1).getByRole('link', { name: 'Chọn gói tập' }).click();
      await page.getByRole('link', { name: 'Đăng nhập ngay' }).click();
      await login(page);
      note({ finalURL: page.url() });
      assert.ok(page.url().includes('/member/packages'), 'Login sends the buyer to dashboard instead of resuming the chosen package.');
    });

    await check(browser, 'phone-placeholder', 'Registration accepts the phone format shown in its placeholder', async ({ page }) => {
      await page.goto(`${base}/register`);
      await fillRegister(page, { phone: '0912 345 678' });
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      assert.equal(await page.locator('[role="alert"]').count(), 0, 'The displayed phone format is rejected.');
    }, { width: 390, height: 844, mobile: true });

    await check(browser, 'validation', 'Short username/password and invalid phone are blocked without API writes', async ({ page, state }) => {
      await page.goto(`${base}/register`);
      for (const invalid of [{ username: 'ab' }, { password: '12345' }, { phone: '1234' }]) {
        await fillRegister(page, invalid);
        await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
        await page.getByRole('alert').waitFor();
      }
      assert.equal(state.calls.filter(c => c.endpoint === '/auth/register').length, 0);
    });

    await check(browser, 'otp-retry', 'Wrong OTP keeps the form; cooldown blocks resending; correct OTP recovers', async ({ page }) => {
      await page.goto(`${base}/register`); await fillRegister(page);
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.locator('#otp-code').fill('999999');
      await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button', { name: /Gửi lại mã sau/ }).isDisabled(), true);
      await page.locator('#otp-code').fill('123456');
      await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT' }).click();
      await page.waitForURL('**/login');
    });

    await check(browser, 'otp-send-recovery', 'A failed OTP delivery after account creation can be retried', async ({ page, note }) => {
      await page.goto(`${base}/register`); await fillRegister(page);
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.getByRole('alert').waitFor();
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.waitForTimeout(200);
      note(await page.getByRole('alert').innerText());
      assert.equal(await page.locator('#otp-code').count(), 1, 'Retry registers the already-created account again and hits 409, instead of resending OTP.');
    }, { state: { failOtpOnce: true }, capture: true });

    await check(browser, 'otp-refresh', 'Refreshing the OTP screen preserves the email and verification step', async ({ page }) => {
      await page.goto(`${base}/register`); await fillRegister(page);
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.locator('#otp-code').waitFor();
      await page.reload();
      assert.equal(await page.locator('#otp-code').count(), 1, 'Reload loses OTP state and returns to a blank registration form.');
    });

    await check(browser, 'double-submit', 'Rapid double-click creates only one pending request', async ({ page, state }) => {
      await packages(page);
      await createButtons(page).first().evaluate(el => { el.click(); el.click(); });
      await page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true }).waitFor();
      assert.equal(writes(state), 1);
      assert.equal(await page.locator('.grid-3 article button:enabled').count(), 0);
    }, { member: true, state: { createDelay: 350 } });

    await check(browser, 'purchase-500-retry', 'Server failure shows a message and allows retry', async ({ page, state }) => {
      await packages(page); await createButtons(page).first().click();
      await page.getByRole('alert').filter({ hasText: 'Không thể tạo yêu cầu' }).waitFor();
      state.createError = null;
      await createButtons(page).first().click();
      await page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true }).waitFor();
      assert.equal(writes(state), 2);
    }, { member: true, state: { createError: 500 } });

    await check(browser, 'lost-response', 'Lost response after server acceptance does not allow a duplicate purchase', async ({ page, state }) => {
      await packages(page); await createButtons(page).first().click();
      await page.getByText('Đang chờ xác nhận tại quầy Lễ tân', { exact: true }).waitFor();
      assert.equal(await page.locator('.grid-3 article button:enabled').count(), 0);
      assert.equal(writes(state), 1);
    }, { member: true, state: { lostResponse: true } });

    for (const endpoint of ['/packages', '/memberships/subscriptions/history', '/payments/my']) {
      await check(browser, `read-error-${endpoint.split('/').pop()}`, `Read failure ${endpoint}: clear retry and no purchase while status unknown`, async ({ page, state }) => {
        await page.goto(`${base}/member/packages`);
        const error = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Thử lại' }) }).first();
        await error.waitFor();
        assert.equal(await page.locator('.grid-3 article button:enabled').count(), 0);
        state.failures = {};
        await error.getByRole('button', { name: 'Thử lại' }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.grid-3 article button')].some(b => !b.disabled));
      }, { member: true, state: { failures: { [endpoint]: 500 } } });
    }

    await check(browser, 'empty-packages', 'Empty or inactive catalog gives an explicit empty state', async ({ page }) => {
      await page.goto(`${base}/member/packages`);
      await page.getByRole('heading', { name: 'Chưa có gói tập khả dụng' }).waitFor();
      assert.equal(await createButtons(page).count(), 0);
    }, { member: true, state: { packages: [] } });

    await check(browser, 'loading-status', 'Slow membership status shows loading and blocks purchasing', async ({ page }) => {
      await page.goto(`${base}/member/packages`);
      await page.locator('.grid-3 article').first().waitFor();
      assert.equal(await page.locator('.grid-3 article button:enabled').count(), 0);
      await page.waitForFunction(() => [...document.querySelectorAll('.grid-3 article button')].some(b => !b.disabled));
    }, { member: true, state: { delayPath: '/memberships/subscriptions/history' } });

    await check(browser, 'pending-reload-cancel', 'Pending request survives reload, cancellation confirms, then a different package can be selected', async ({ page, state }) => {
      await packages(page); await createButtons(page).first().click();
      await page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true }).getByRole('button', { name: 'Đóng', exact: true }).click();
      await page.reload();
      await page.getByText('Đang chờ xác nhận tại quầy Lễ tân', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Hủy yêu cầu đăng ký', exact: true }).first().click();
      await page.getByRole('dialog', { name: 'Hủy yêu cầu đăng ký?' }).getByRole('button', { name: 'Xác nhận hủy' }).click();
      await page.getByRole('status').filter({ hasText: 'Đã hủy yêu cầu' }).waitFor();
      assert.equal(state.history[0].status, 'cancelled');
      assert.equal(await page.locator('.grid-3 article button:enabled').count(), 3);
    }, { member: true });

    await check(browser, 'dialog-keyboard', 'Purchase dialog captures focus, traps Tab, and closes with Escape', async ({ page, note }) => {
      await packages(page); await createButtons(page).first().click();
      const dialog = page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true });
      await dialog.waitFor();
      const inside = await dialog.evaluate(el => el.contains(document.activeElement));
      await page.keyboard.press('Escape');
      const tabFocus = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        tabFocus.push(await dialog.evaluate(el => el.contains(document.activeElement)));
      }
      note({ focusInside: inside, stillOpenAfterEscape: await dialog.count(), tabFocusInsideDialog: tabFocus });
      assert.ok(inside, 'Focus stays on the disabled purchase button behind the dialog.');
      assert.equal(await dialog.count(), 0, 'Escape does not close the purchase dialog.');
    }, { member: true, capture: true });

    for (const [width, height] of [[390, 844], [375, 667], [320, 568], [844, 390]]) {
      await check(browser, `mobile-dialog-${width}`, 'Request summary and close/cancel controls fit the mobile viewport', async ({ page, note }) => {
        await packages(page); await createButtons(page).first().click();
        const dialog = page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true }); await dialog.waitFor();
        const box = await dialog.boundingBox();
        const close = await dialog.getByRole('button', { name: 'Đóng', exact: true }).boundingBox();
        note({ dialog: box, close, viewport: { width, height }, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
        assert.ok(box.y >= 0 && box.y + box.height <= height, 'Fixed overlay dialog exceeds the viewport without its own scroll area.');
        assert.ok(close.y + close.height <= height, 'Close button is below the viewport.');
      }, { member: true, width, height, mobile: true, capture: true });
    }

    await check(browser, 'cancel-error-visible', 'Cancellation conflict is explained inside the open confirmation dialog', async ({ page, note }) => {
      await packages(page); await createButtons(page).first().click();
      await page.getByRole('dialog', { name: 'Đăng ký gói tập', exact: true }).getByRole('button', { name: 'Hủy yêu cầu đăng ký' }).click();
      const dialog = page.getByRole('dialog', { name: 'Hủy yêu cầu đăng ký?' });
      await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click();
      await page.getByRole('alert').filter({ hasText: 'không thể hủy' }).waitFor();
      note({ alertInDialog: await dialog.getByRole('alert').count(), dialogsOpen: await page.getByRole('dialog').count() });
      assert.equal(await dialog.getByRole('alert').count(), 1, 'Error is rendered behind the stacked dialogs instead of beside the cancellation action.');
    }, { member: true, state: { cancelError: true }, capture: true });

    await check(browser, 'manual-activation', 'After reception confirms payment, refresh shows active membership', async ({ page, state }) => {
      state.history = [subscription(state.packages[0])];
      await packages(page);
      state.current = { ...state.history[0], status: 'active' }; state.history = [state.current];
      state.payments = [{ id: 1, subscriptionId: 9001, status: 'success', amount: state.packages[0].price }];
      await page.getByRole('button', { name: 'Tải lại trạng thái' }).click();
      await page.getByText('Gói hiện tại', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Gia hạn', exact: true }).count(), 1);
    }, { member: true });

    await check(browser, 'expired-session', 'Expired session returns to login with an explanation', async ({ page }) => {
      await page.goto(`${base}/member/packages`);
      await page.waitForURL('**/login?expired=1');
      await page.getByRole('status').filter({ hasText: 'Phiên đăng nhập đã hết hạn' }).waitFor();
    }, { member: true, state: { failures: { '/memberships/subscriptions/my': 401 } } });

    await check(browser, 'login-error-retry', 'Incorrect credentials keep input; retry succeeds without registering again', async ({ page, state }) => {
      await page.goto(`${base}/login`);
      await page.locator('form button[type="submit"]').first().click();
      assert.equal(state.calls.filter(c => c.endpoint === '/auth/login').length, 0);
      await page.locator('#login-identifier').fill('ux_buyer');
      await page.locator('#login-password').fill('Buyer123!');
      await page.locator('form button[type="submit"]').first().click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('#login-identifier').inputValue(), 'ux_buyer');
      state.loginError = false; await login(page);
    }, { state: { loginError: true } });

    await check(browser, 'otp-back-edit', 'Changing optional information during OTP does not re-register the same account', async ({ page }) => {
      await page.goto(`${base}/register`); await fillRegister(page);
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.getByRole('button', { name: '← Đổi thông tin' }).click();
      await page.locator('#reg-phone').fill('0912345678');
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#otp-code').count(), 1, 'Change information returns to account creation, which now fails as duplicate.');
    });

    await check(browser, 'registration-error-a11y', 'Invalid phone is associated with its input for keyboard/screen-reader users', async ({ page, note }) => {
      await page.goto(`${base}/register`); await fillRegister(page, { phone: '1234' });
      await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC' }).click();
      await page.getByRole('alert').waitFor();
      note({ invalid: await page.locator('#reg-phone').getAttribute('aria-invalid'), describedBy: await page.locator('#reg-phone').getAttribute('aria-describedby'), activeId: await page.evaluate(() => document.activeElement.id) });
      assert.equal(await page.locator('#reg-phone').getAttribute('aria-invalid'), 'true', 'Error is only a general banner; invalid input has no programmatic error association.');
    });

    await check(browser, 'pending-payment-guard', 'An existing payment-pending request blocks another purchase and cancellation', async ({ page, state }) => {
      const sub = subscription(state.packages[0]); state.history = [sub];
      state.payments = [{ id: 1, subscriptionId: sub.id, status: 'pending', amount: state.packages[0].price }];
      await packages(page);
      assert.equal(await page.locator('.grid-3 article button:enabled').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Hủy yêu cầu đăng ký', exact: true }).first().isDisabled(), true);
      assert.equal(writes(state), 0);
    }, { member: true });

    await check(browser, 'catalog-failure-retry', 'Landing handles catalog unavailability without showing invented prices', async ({ page, state }) => {
      await page.goto(`${base}/#packages`);
      const pricing = page.locator('#packages');
      await pricing.getByRole('button', { name: 'Thử lại' }).waitFor();
      assert.equal(await page.locator('.fit-plan').count(), 0);
      state.failures = {};
      await pricing.getByRole('button', { name: 'Thử lại' }).click();
      await page.locator('.fit-plan').first().waitFor();
      assert.equal(await page.locator('.fit-plan').count(), catalog.packages.length);
    }, { state: { failures: { '/public/catalog': 500 } } });

    await check(browser, 'landing-normal-motion', 'A mobile guest can find pricing through the menu with animation enabled', async ({ page }) => {
      await page.goto(base);
      await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
      await page.locator('.fit-nav').getByRole('link', { name: 'Gói tập', exact: true }).click();
      await page.locator('.fit-plan').first().getByRole('link', { name: 'Chọn gói tập' }).click();
      await page.locator('#reg-username').waitFor();
    }, { width: 390, height: 844, mobile: true, motion: true });

    for (const theme of ['light', 'dark']) {
      await check(browser, `auth-button-contrast-${theme}`, 'Registration submit text has readable contrast', async ({ page, note }) => {
        await page.goto(`${base}/register`);
        const button = page.locator('.luxury-login-submit-btn');
        const lum = s => s.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        for (const hover of [false, true]) {
          if (hover) { await button.hover(); await page.waitForTimeout(450); }
          const colors = await button.evaluate(el => ({ color: getComputedStyle(el.querySelector('span')).color, background: getComputedStyle(el).backgroundColor }));
          const l1 = lum(colors.color), l2 = lum(colors.background);
          const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
          note({ ...colors, hover, ratio });
          assert.ok(ratio >= 4.5, `Submit text hover=${hover} contrast is ${ratio.toFixed(2)}:1.`);
        }
      }, { theme, capture: true });
    }

    console.log('SUMMARY', JSON.stringify(results.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {})));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
