import { expect, test, type Page } from '@playwright/test';

// Browser integration tests use controlled API responses, never a live account.
// Backend authorization and database invariants are exercised by the API CI job.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  // Functional checks must not depend on third-party fonts or decorative images.
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)\//, (route) => route.abort());
});

async function fillLogin(page: Page) {
  await page.getByLabel('Tên đăng nhập hoặc Email', { exact: true }).fill('browser.member');
  await page.getByLabel('Mật Khẩu', { exact: true }).fill('BrowserTest_123!');
}

test('public navigation connects landing, login and registration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'LOGIN', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Đăng ký hội viên', exact: true }).click();
  await expect(page).toHaveURL('/register');
  await expect(page.getByRole('heading', { name: 'Đăng ký Hội viên', exact: true })).toBeVisible();
});

for (const path of ['/member/dashboard', '/staff/reception', '/manager/users']) {
  test(`anonymous visitors are redirected from ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true })).toBeVisible();
  });
}

test('login validates required fields before sending an API request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/login')) requests.push(request.url());
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Vui lòng nhập tên đăng nhập hoặc email.');
  await page.getByLabel('Tên đăng nhập hoặc Email', { exact: true }).fill('browser.member');
  await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Vui lòng nhập mật khẩu.');
  expect(requests).toHaveLength(0);
});

test('password visibility can be toggled without losing the value', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Mật Khẩu', { exact: true });
  await password.fill('BrowserTest_123!');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('BrowserTest_123!');
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('rejected login displays the API error and allows another attempt', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({
    status: 401,
    json: { message: 'Tên đăng nhập hoặc mật khẩu không đúng.' },
  }));
  await page.goto('/login');
  await fillLogin(page);
  await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Tên đăng nhập hoặc mật khẩu không đúng.');
  await expect(page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true })).toBeEnabled();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => localStorage.getItem('fitcenter_token'))).toBeNull();
});

test('network failure is shown in the login form', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page);
  await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối tới máy chủ.');
  await expect(page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true })).toBeEnabled();
});

test('member login persists, blocks manager access and logout clears the session', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({
    json: { data: { token: 'browser-test-token', username: 'browser.member', role: 'MEMBER' } },
  }));
  await page.goto('/login');
  await fillLogin(page);
  const loginRequest = page.waitForRequest('**/api/v1/auth/login');
  await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
  const request = await loginRequest;
  expect(request.method()).toBe('POST');
  expect(request.postDataJSON()).toEqual({ username: 'browser.member', password: 'BrowserTest_123!' });
  await expect(page).toHaveURL('/member/dashboard');
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  await page.goto('/manager/users');
  await expect(page).toHaveURL('/member/dashboard');
  await expect(page.getByRole('link', { name: 'Tài khoản & Phân quyền', exact: true })).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => localStorage.getItem('fitcenter_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('fitcenter_auth_session'))).toBeNull();
  await page.goto('/member/dashboard');
  await expect(page).toHaveURL('/login');
});

test('expired session explains why the user must sign in again', async ({ page }) => {
  await page.route('**/api/v1/profile', (route) => route.fulfill({
    status: 401, json: { message: 'Phiên đăng nhập đã hết hạn.' },
  }));
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('fitcenter_token', 'expired-browser-token');
    localStorage.setItem('fitcenter_auth_session', JSON.stringify({
      id: 'browser.member', name: 'browser.member', identifier: 'browser.member', role: 'MEMBER',
    }));
  });
  await page.goto('/member/profile');
  await expect(page).toHaveURL('/login?expired=1');
  await expect(page.getByRole('status')).toContainText('Phiên đăng nhập đã hết hạn');
  await expect(page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('fitcenter_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('fitcenter_auth_session'))).toBeNull();
});

test('registration validates input and completes the OTP flow', async ({ page }) => {
  await page.route('**/api/v1/auth/register', (route) => route.fulfill({ status: 201, json: { data: {} } }));
  await page.route('**/api/v1/auth/send-otp', (route) => route.fulfill({ json: { data: {} } }));
  await page.route('**/api/v1/auth/verify-otp', (route) => route.fulfill({ json: { data: {} } }));
  await page.goto('/register');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('ab');
  await page.getByLabel('Địa chỉ Email', { exact: true }).fill('browser@example.invalid');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('BrowserTest_123!');
  await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Tên đăng nhập cần tối thiểu 3 ký tự.');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('browser.member');
  const registerRequest = page.waitForRequest('**/api/v1/auth/register');
  await page.getByRole('button', { name: 'TIẾP TỤC XÁC THỰC', exact: true }).click();
  expect((await registerRequest).postDataJSON()).toEqual({
    username: 'browser.member', email: 'browser@example.invalid', password: 'BrowserTest_123!',
  });
  await expect(page.getByRole('heading', { name: 'Xác thực OTP', exact: true })).toBeVisible();
  await page.getByLabel('Nhập mã 6 chữ số', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Mã OTP gồm đúng 6 chữ số.');
  await page.getByLabel('Nhập mã 6 chữ số', { exact: true }).fill('123456');
  const verifyRequest = page.waitForRequest('**/api/v1/auth/verify-otp');
  await page.getByRole('button', { name: 'XÁC THỰC & HOÀN TẤT', exact: true }).click();
  expect((await verifyRequest).postDataJSON()).toEqual({ target: 'browser@example.invalid', otpCode: '123456' });
  await expect(page).toHaveURL('/login');
});
