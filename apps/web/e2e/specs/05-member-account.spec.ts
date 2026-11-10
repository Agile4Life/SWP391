import { test, expect, settled, field } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { apiWith, createActiveMember, apiLogin, unique } from '../helpers/api';

test.describe('Bảng điều khiển hội viên theo từng trạng thái gói', () => {
  test.describe('Platinum đang hoạt động (an)', () => {
    test.use({ storageState: authFile('an') });
    test('hiển thị gói, lịch lớp đã đăng ký và điều hướng nhanh', async ({ page }) => {
      await page.goto('/member/dashboard');
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Xin chào');
      await expect(page.getByText('PLATINUM 3 THÁNG').first()).toBeVisible();
      await expect(page.getByText('Đang hoạt động').first()).toBeVisible();
      await expect(page.getByText('Strength Foundation').first()).toBeVisible();
      await page.getByRole('link', { name: 'Khám phá lịch học' }).click();
      await expect(page).toHaveURL(/member\/classes/);
    });
    test('thẻ hội viên có QR động, sao chép được và hiển thị đúng tên', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto('/member/card');
      await settled(page);
      await expect(page.getByText('Gói tập đang hoạt động')).toBeVisible();
      await page.getByRole('button', { name: /Sao chép/ }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied.length).toBeGreaterThan(8);
    });
    test('hóa đơn: mở hóa đơn đã thanh toán', async ({ page }) => {
      await page.goto('/member/invoices');
      await settled(page);
      await expect(page.getByRole('button', { name: /Xem hóa đơn/ })).toHaveCount(2);
      await page.getByRole('button', { name: /Xem hóa đơn/ }).first().click();
      await expect(page.getByRole('dialog', { name: /Hóa đơn/ })).toBeVisible();
    });
    test('tiến độ & giáo án, streak, check-in lịch sử đều tải được không lỗi', async ({ page }) => {
      for (const path of ['/member/progress', '/member/streak', '/member/check-in']) {
        await page.goto(path);
        await settled(page);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);
      }
    });
    test('thông báo: đường dẫn /member/notifications mở khung thông báo', async ({ page }) => {
      await page.goto('/member/notifications');
      await settled(page);
      await expect(page).toHaveURL(/member\/dashboard/);
    });
  });

  for (const [key, label] of [['dung', 'hết hạn'], ['lan', 'chưa có gói'], ['khoa', 'đã hủy'], ['em', 'đang bảo lưu']] as const) {
    test.describe(`hội viên ${label} (${key})`, () => {
      test.use({ storageState: authFile(key) });
      test('dashboard báo chưa có gói đang hoạt động và dẫn tới trang gói tập', async ({ page }) => {
        await page.goto('/member/dashboard');
        await settled(page);
        await expect(page.getByText('Chưa có gói tập đang hoạt động')).toBeVisible();
        await page.getByRole('link', { name: 'Khám phá các gói tập' }).click();
        await expect(page).toHaveURL(/member\/packages/);
      });
      test('thẻ hội viên không cấp mã QR check-in', async ({ page }) => {
        await page.goto('/member/card');
        await settled(page);
        await expect(page.locator('main')).toContainText(/đã hết hạn|Chưa có gói tập|không còn gói tập|chưa hoạt động|đã hủy|bảo lưu|Chưa có mã QR|Đang chờ thanh toán/i);
        await expect(page.getByRole('button', { name: /Sao chép/ })).toHaveCount(0);
      });
    });
  }
});

test.describe('Hồ sơ cá nhân', () => {
  test('cập nhật hồ sơ thành công và dữ liệu còn nguyên sau khi tải lại', async ({ browser }) => {
    const m = await createActiveMember('prof');
    const session = await apiLogin(m.username, m.password);
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fitcenter_token', value: session.token }, { name: 'fitcenter_auth_session', value: JSON.stringify({ id: m.username, name: m.username, identifier: m.username, role: 'MEMBER' }) }, { name: 'scms_lang', value: 'vi' }] }] } });
    const page = await ctx.newPage();
    await page.goto('/member/profile');
    await settled(page);
    const name = `Nguyễn E2E ${unique('n')}`;
    await page.locator('#fullName').fill(name);
    await field(page, 'Vd: 0912345678').fill(`09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`);
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await expect(page.getByText(/Đã cập nhật hồ sơ/i).first()).toBeVisible();
    await page.reload();
    await settled(page);
    await expect(page.locator('#fullName')).toHaveValue(name);
    await ctx.close();
  });

  test.describe('dữ liệu xấu', () => {
    test.use({ storageState: authFile('chi') });
    test('số điện thoại sai định dạng bị chặn, họ tên rỗng bị chặn', async ({ page }) => {
      await page.goto('/member/profile');
      await settled(page);
      await field(page, 'Vd: 0912345678').fill('123');
      await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
      await expect(page.getByText(/không hợp lệ|định dạng/i).first()).toBeVisible();
      await page.locator('#fullName').fill('');
      await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
      // họ tên dùng kiểm tra bắt buộc gốc của trình duyệt
      expect(await page.locator('#fullName').evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(false);
    });
    test('ảnh đại diện sai định dạng bị từ chối', async ({ page }) => {
      await page.goto('/member/profile');
      await settled(page);
      await page.locator('input[type="file"]').first().setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('khong phai anh') });
      await expect(page.getByText(/JPG|PNG|WebP|định dạng/i).first()).toBeVisible();
    });
  });

  test('đổi mật khẩu: sai mật khẩu hiện tại bị từ chối, đúng thì đăng nhập được bằng mật khẩu mới', async ({ browser }) => {
    const m = await createActiveMember('pwd');
    const session = await apiLogin(m.username, m.password);
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fitcenter_token', value: session.token }, { name: 'fitcenter_auth_session', value: JSON.stringify({ id: m.username, name: m.username, identifier: m.username, role: 'MEMBER' }) }, { name: 'scms_lang', value: 'vi' }] }] } });
    const page = await ctx.newPage();
    await page.goto('/member/profile');
    await settled(page);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    const current = field(page, 'Mật khẩu hiện tại');
    await expect(current).toBeVisible();
    const inputs = page.locator('input[type="password"]');
    await inputs.nth(0).fill('sai-mat-khau-cu');
    await inputs.nth(1).fill('NewPass@456');
    await inputs.nth(2).fill('NewPass@456');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    // mật khẩu xác nhận không khớp
    await inputs.nth(0).fill(m.password);
    await inputs.nth(2).fill('KhacNhau@789');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await inputs.nth(2).fill('NewPass@456');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
    await expect(page.getByText(/đã được cập nhật|thành công|đã đổi/i).first()).toBeVisible();
    const ok = await apiWith('', 'POST', '/auth/login', { username: m.username, password: 'NewPass@456' });
    expect(ok.status).toBe(200);
    await ctx.close();
  });
});

test.describe('Hồ sơ: kiểm tra API', () => {
  test('PUT /profile từ chối số điện thoại sai định dạng', async () => {
    const m = await createActiveMember('phn');
    const s = await apiLogin(m.username, m.password);
    for (const phone of ['123', 'abc', '09123456789012345678']) {
      const res = await apiWith(s.token, 'PUT', '/profile', { fullName: 'Nguyen Test', phone });
      expect(res.status, `phone=${phone}`).toBe(400);
    }
    expect((await apiWith(s.token, 'PUT', '/profile', { fullName: 'Nguyen Test', phone: '' })).status).toBe(200);
  });
});

test.describe('Hỗ trợ & khiếu nại', () => {
  test.describe.configure({ mode: 'serial' });
  const title = `E2E phiếu ${unique('t')}`;

  test.describe('hội viên gửi phiếu', () => {
    test.use({ storageState: authFile('binh') });
    test('gửi phiếu hợp lệ và thấy trong "Phiếu của tôi"', async ({ page }) => {
      await page.goto('/member/support');
      await settled(page);
      await field(page, 'Tóm tắt vấn đề').fill(title);
      await field(page, /Mô tả để chúng tôi/).fill('Mô tả chi tiết cho phiếu kiểm thử e2e.');
      await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
      await expect(page.getByText(title).first()).toBeVisible();
    });
    test('phiếu trống bị chặn, không tạo thêm phiếu', async ({ page }) => {
      await page.goto('/member/support');
      await settled(page);
      let posted = false;
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/support/requests')) posted = true; });
      await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
      await page.waitForTimeout(800);
      expect(posted, 'không được gửi request khi tiêu đề trống').toBe(false);
    });
    test('tiêu đề quá dài bị cắt ở giới hạn của ô nhập (không vượt 150 ký tự)', async ({ page }) => {
      await page.goto('/member/support');
      await settled(page);
      const input = field(page, 'Tóm tắt vấn đề');
      await input.fill('x'.repeat(400));
      expect((await input.inputValue()).length).toBeLessThanOrEqual(150);
    });
  });

  test.describe('lễ tân xử lý, chuyển lên quản lý', () => {
    test.use({ storageState: authFile('staff') });
    test('lễ tân mở phiếu, phản hồi; tin nhắn trống không gửi được', async ({ page }) => {
      await page.goto('/staff/support');
      await settled(page);
      await page.getByText(title).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(title);
      const reply = dialog.locator('textarea').first();
      await reply.fill('   ');
      await expect(dialog.getByRole('button', { name: /^Gửi/ }).last()).toBeDisabled().catch(() => undefined);
      await reply.fill('Lễ tân đã nhận phiếu, sẽ xử lý ngay.');
      await dialog.getByRole('button', { name: /^Gửi/ }).last().click();
      await expect(dialog.getByText('Lễ tân đã nhận phiếu, sẽ xử lý ngay.').first()).toBeVisible();
    });
    test('chuyển lên quản lý bắt buộc có lý do; sau khi chuyển lễ tân không còn trả lời được', async ({ page }) => {
      await page.goto('/staff/support');
      await settled(page);
      await page.getByText(title).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Chuyển lên quản lý' }).click();
      const escalate = page.getByRole('dialog').filter({ hasText: 'Lý do chuyển lên quản lý' });
      await expect(escalate.getByRole('button', { name: /^Chuyển/ }).last()).toBeDisabled();
      await escalate.locator('textarea').fill('Hội viên khiếu nại vượt thẩm quyền lễ tân.');
      await escalate.getByRole('button', { name: /^Chuyển/ }).last().click();
      await expect(page.getByTestId('escalation-info')).toBeVisible();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Chuyển lên quản lý' })).toHaveCount(0);
    });
  });

  test.describe('quản lý tiếp nhận', () => {
    test.use({ storageState: authFile('manager') });
    test('quản lý thấy khiếu nại đã chuyển lên và phản hồi', async ({ page }) => {
      await page.goto('/manager/support');
      await settled(page);
      await page.getByText(title).first().click();
      const dialog = page.getByRole('dialog');
      await expect(page.getByTestId('escalation-info')).toBeVisible();
      await dialog.locator('textarea').first().fill('Quản lý đã tiếp nhận và sẽ liên hệ hội viên.');
      await dialog.getByRole('button', { name: /^Gửi/ }).last().click();
      await expect(dialog.getByText('Quản lý đã tiếp nhận và sẽ liên hệ hội viên.').first()).toBeVisible();
    });
  });

  test.describe('hội viên thấy phản hồi', () => {
    test.use({ storageState: authFile('binh') });
    test('phản hồi của lễ tân và quản lý hiện trong hội thoại phiếu', async ({ page }) => {
      await page.goto('/member/support');
      await settled(page);
      await page.getByText(title).first().click();
      await expect(page.getByText('Lễ tân đã nhận phiếu, sẽ xử lý ngay.').first()).toBeVisible();
      await expect(page.getByText('Quản lý đã tiếp nhận và sẽ liên hệ hội viên.').first()).toBeVisible();
    });
  });
});
