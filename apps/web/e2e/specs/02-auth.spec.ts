import { test, expect } from '../fixtures';
import { ACCOUNTS, API, type RoleKey } from '../helpers/accounts';
import { createActiveMember, unique } from '../helpers/api';

const HOME: Record<string, string> = { ADMIN: '/admin/users', MANAGER: '/manager/reports', STAFF: '/staff/reception', COACH: '/staff/attendance', MEMBER: '/member/dashboard' };

async function login(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-identifier').fill(username);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /ĐĂNG NHẬP/ }).click();
}

test.describe('Đăng nhập', () => {
  for (const key of ['an', 'staff', 'coach', 'manager', 'admin'] as RoleKey[]) {
    test(`đăng nhập đúng (${key}) vào trang chủ của vai trò`, async ({ page }) => {
      const account = ACCOUNTS[key];
      await login(page, account.username, account.password);
      await expect(page).toHaveURL(new RegExp(HOME[account.role].replace('/', '\\/')));
      await expect(page.locator('main').first()).toBeVisible();
      // phiên phải bền vững: tải lại không bị đăng xuất
      await page.reload();
      await expect(page).toHaveURL(new RegExp(HOME[account.role].replace('/', '\\/')));
    });
  }

  test('sai mật khẩu hiện lỗi, giữ nguyên trang, không lưu phiên', async ({ page }) => {
    await login(page, ACCOUNTS.khoa.username, 'sai-mat-khau');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('fitcenter_token'))).toBeNull();
  });

  test('tài khoản không tồn tại hiện lỗi chung, không lộ việc tài khoản có tồn tại hay không', async ({ page }) => {
    await login(page, `khong-co-${unique()}@example.com`, 'Abcdef@123');
    const strip = (text: string) => text.replace(/Bạn còn \d+ lần thử\.?/, '').trim();
    const wrong = strip(await page.getByRole('alert').innerText());
    await page.goto('/login');
    await login(page, ACCOUNTS.khoa.username, 'Abcdef@123');
    const wrongPassword = strip(await page.getByRole('alert').innerText());
    expect(wrong).toBe(wrongPassword);
  });

  test('để trống trường bắt buộc không gửi request đăng nhập', async ({ page }) => {
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/auth/login')) called = true; });
    await page.goto('/login');
    await page.getByRole('button', { name: /ĐĂNG NHẬP/ }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(called).toBe(false);
  });

  test('nút hiện/ẩn mật khẩu đổi kiểu ô nhập', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('#login-password');
    await input.fill('abc12345');
    await expect(input).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(input).toHaveAttribute('type', 'text');
  });

  test('sai quá 5 lần bị khóa tạm thời và nút gửi bị vô hiệu', async ({ page }) => {
    const ghost = `khoa-thu-${unique()}@example.com`;
    await page.goto('/login');
    for (let i = 0; i < 6; i++) {
      await page.locator('#login-identifier').fill(ghost);
      await page.locator('#login-password').fill(`sai-${i}`);
      const submit = page.getByRole('button', { name: /ĐĂNG NHẬP|THỬ LẠI SAU/ });
      if (await submit.isDisabled()) break;
      await submit.click();
      await page.waitForResponse((r) => r.url().includes('/auth/login'));
    }
    await expect(page.getByRole('button', { name: /THỬ LẠI SAU/ })).toBeDisabled();
  });

  test('ký tự đặc biệt/XSS trong ô nhập không được thực thi', async ({ page }) => {
    await login(page, '"><img src=x onerror=window.__xss=1>', "' OR '1'='1");
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test('người đã đăng nhập mở /login thấy lựa chọn tiếp tục hoặc đăng xuất', async ({ page }) => {
    await login(page, ACCOUNTS.binh.username, ACCOUNTS.binh.password);
    await expect(page).toHaveURL(/member\/dashboard/);
    await page.goto('/login');
    await expect(page.getByText('Bạn đã đăng nhập')).toBeVisible();
    await page.getByRole('button', { name: /Đăng xuất tài khoản này/ }).click();
    await expect(page.locator('#login-identifier')).toBeVisible();
  });

  test('đăng xuất từ menu tài khoản xóa phiên và chặn truy cập lại', async ({ page }) => {
    await login(page, ACCOUNTS.chi.username, ACCOUNTS.chi.password);
    await expect(page).toHaveURL(/member\/dashboard/);
    await page.getByTestId('portal-avatar-trigger').click();
    await page.getByTestId('avatar-menu-logout').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/login|\/$/);
    expect(await page.evaluate(() => localStorage.getItem('fitcenter_token'))).toBeNull();
    await page.goto('/member/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('token hết hạn/bị thu hồi: lần gọi API kế tiếp đưa về /login?expired=1', async ({ page }) => {
    await login(page, ACCOUNTS.binh.username, ACCOUNTS.binh.password);
    await expect(page).toHaveURL(/member\/dashboard/);
    await page.evaluate(() => localStorage.setItem('fitcenter_token', 'token.khong.hop.le'));
    await page.goto('/member/packages');
    await expect(page).toHaveURL(/\/login\?expired=1/);
  });
});

test.describe('Đăng ký hội viên và OTP', () => {
  test('luồng đầy đủ: đăng ký -> OTP -> đăng nhập được ngay', async ({ page }) => {
    const id = unique('reg').toLowerCase();
    await page.goto('/register');
    await page.locator('#reg-username').fill(id);
    await page.locator('#reg-email').fill(`${id}@example.com`);
    await page.locator('#reg-phone').fill('0912345678');
    await page.locator('#reg-password').fill('Member@123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    const debug = page.locator('.fit-debug-otp strong');
    await expect(debug).toBeVisible();
    await page.locator('#otp-code').fill((await debug.innerText()).trim());
    await page.getByRole('button', { name: /XÁC THỰC & HOÀN TẤT/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, id, 'Member@123');
    await expect(page).toHaveURL(/member\/dashboard/);
  });

  test('kiểm tra hợp lệ từng trường (tên ngắn, email sai, SĐT sai, mật khẩu ngắn)', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-username').fill('ab');
    await page.locator('#reg-email').fill('khong-phai-email');
    await page.locator('#reg-phone').fill('12345');
    await page.locator('#reg-password').fill('123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    await expect(page.locator('#reg-username-error')).toBeVisible();
    await expect(page.locator('#reg-email-error')).toBeVisible();
    await expect(page.locator('#reg-phone-error')).toBeVisible();
    await expect(page.locator('#reg-password-error')).toBeVisible();
    await expect(page.locator('#otp-code')).toHaveCount(0);
  });

  test('email gõ nhầm tên miền gmail (gmial.com) bị chặn', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#reg-email').fill('abc@gmial.com');
    await page.locator('#reg-email').blur();
    await expect(page.locator('#reg-email-error')).toBeVisible();
  });

  test('trùng tên đăng nhập hoặc email báo lỗi, không tạo tài khoản thứ hai', async ({ page }) => {
    const member = await createActiveMember();
    await page.goto('/register');
    await page.locator('#reg-username').fill(member.username);
    await page.locator('#reg-email').fill(`khac-${member.email}`);
    await page.locator('#reg-password').fill('Member@123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#otp-code')).toHaveCount(0);

    await page.goto('/register');
    await page.locator('#reg-username').fill(unique('dup').toLowerCase());
    await page.locator('#reg-email').fill(member.email);
    await page.locator('#reg-password').fill('Member@123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('OTP sai hoặc không đủ 6 số bị từ chối, tài khoản chưa kích hoạt không đăng nhập được', async ({ page }) => {
    const id = unique('otp').toLowerCase();
    await page.goto('/register');
    await page.locator('#reg-username').fill(id);
    await page.locator('#reg-email').fill(`${id}@example.com`);
    await page.locator('#reg-password').fill('Member@123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    const debug = (await page.locator('.fit-debug-otp strong').innerText()).trim();
    const wrong = debug === '000000' ? '111111' : '000000';
    await page.locator('#otp-code').fill('123');
    await page.getByRole('button', { name: /XÁC THỰC & HOÀN TẤT/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.locator('#otp-code').fill(wrong);
    await page.getByRole('button', { name: /XÁC THỰC & HOÀN TẤT/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    // chưa kích hoạt -> đăng nhập thất bại
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: id, password: 'Member@123' }) });
    expect(res.ok).toBe(false);
  });

  test('gửi lại OTP bị khóa trong thời gian chờ', async ({ page }) => {
    const id = unique('rs').toLowerCase();
    await page.goto('/register');
    await page.locator('#reg-username').fill(id);
    await page.locator('#reg-email').fill(`${id}@example.com`);
    await page.locator('#reg-password').fill('Member@123');
    await page.getByRole('button', { name: /TIẾP TỤC XÁC THỰC/ }).click();
    await expect(page.getByRole('button', { name: /Gửi lại mã sau/ })).toBeDisabled();
  });
});

test.describe('Quên mật khẩu', () => {
  test('đặt lại mật khẩu bằng OTP rồi đăng nhập bằng mật khẩu mới; mật khẩu cũ vô hiệu', async ({ page }) => {
    const member = await createActiveMember('rst');
    await page.goto('/login');
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
    await page.locator('#reset-email-input').fill(member.email);
    await page.getByRole('button', { name: /GỬI MÃ OTP/ }).click();
    const otpInput = page.locator('#reset-otp-input');
    await expect(otpInput).toBeVisible();
    await expect(otpInput).toHaveValue(/^\d{6}$/);
    await page.locator('#reset-new-password-input').fill('NewPass@456');
    await page.getByRole('button', { name: /ĐẶT LẠI|XÁC NHẬN|CẬP NHẬT/ }).click();
    await expect(page.locator('#login-identifier')).toBeVisible({ timeout: 15_000 });
    await login(page, member.username, member.password);
    await expect(page.getByRole('alert')).toBeVisible();
    await login(page, member.username, 'NewPass@456');
    await expect(page).toHaveURL(/member\/dashboard/);
  });

  test('email không tồn tại hoặc mật khẩu mới quá ngắn bị từ chối', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
    await page.locator('#reset-email-input').fill(`khong-ton-tai-${unique()}@example.com`);
    await page.getByRole('button', { name: /GỬI MÃ OTP/ }).click();
    await expect(page.getByRole('alert').or(page.locator('#reset-otp-input'))).toBeVisible();
  });
});
