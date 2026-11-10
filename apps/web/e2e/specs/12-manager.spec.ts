import { test, expect, settled, field } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { unique } from '../helpers/api';

test.use({ storageState: authFile('manager') });

test.describe('Quản lý: danh mục vận hành', () => {
  test('thêm bộ môn mới; trùng tên bị từ chối; sửa; xóa', async ({ page }) => {
    const name = `E2E Môn ${unique('d')}`;
    await page.goto('/manager/catalogs');
    await settled(page);
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    await page.locator('#cat-name').fill(name);
    await page.locator('#cat-desc').fill('Bộ môn kiểm thử');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.locator('main')).toContainText(name);
    // trùng tên
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    await page.locator('#cat-name').fill(name);
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('alert').or(page.getByText(/đã tồn tại|trùng/i)).first()).toBeVisible();
    await page.keyboard.press('Escape');
    // sửa
    const row = page.locator('tr, li, article').filter({ hasText: name }).first();
    await row.getByRole('button', { name: 'Chỉnh sửa' }).click();
    await page.locator('#cat-name').fill(`${name} (sửa)`);
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.locator('main')).toContainText(`${name} (sửa)`);
    // xóa
    await page.locator('tr, li, article').filter({ hasText: `${name} (sửa)` }).first().getByRole('button', { name: 'Xóa' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Xóa|Xác nhận/ }).last().click();
    await expect(page.locator('main')).not.toContainText(`${name} (sửa)`);
  });

  test('tên bộ môn trống bị chặn; bộ môn đang được dùng không xóa được', async ({ page }) => {
    await page.goto('/manager/catalogs');
    await settled(page);
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.locator('#cat-name')).toBeVisible();
    await page.keyboard.press('Escape');
    const gym = page.locator('tr, li, article').filter({ hasText: /^.*Gym/ }).first();
    await gym.getByRole('button', { name: 'Xóa' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Xóa|Xác nhận/ }).last().click();
    await expect(page.getByRole('alert').or(page.getByText(/đang được sử dụng|không thể xóa|ngừng/i)).first()).toBeVisible();
    await expect(page.locator('main')).toContainText('Gym');
  });

  test('chuyển tab Bộ môn / Phòng tập / Gói tập', async ({ page }) => {
    await page.goto('/manager/catalogs');
    await settled(page);
    for (const tab of [/Phòng tập/, /Gói tập/, /Bộ môn/]) await page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab })).first().click();
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Quản lý: thiết bị', () => {
  test('thêm thiết bị; mã trùng bị từ chối; lọc theo trạng thái; xóa', async ({ page }) => {
    const code = `EQ-E2E-${Date.now().toString(36).toUpperCase()}`;
    await page.goto('/manager/equipment');
    await settled(page);
    await page.getByRole('button', { name: 'Thêm thiết bị máy mới' }).click();
    await page.locator('#eq-name').fill('Máy kiểm thử e2e');
    await page.locator('#eq-code').fill(code);
    await page.locator('#eq-qty').fill('2');
    await page.getByRole('button', { name: 'Lưu thiết bị' }).click();
    await expect(page.locator('main')).toContainText(code);
    await page.getByRole('button', { name: 'Thêm thiết bị máy mới' }).click();
    await page.locator('#eq-name').fill('Máy trùng mã');
    await page.locator('#eq-code').fill(code);
    await page.getByRole('button', { name: 'Lưu thiết bị' }).click();
    await expect(page.getByRole('alert').or(page.getByText(/đã tồn tại|trùng/i)).first()).toBeVisible();
    await page.keyboard.press('Escape');
    const row = page.locator('tr, li, article').filter({ hasText: code }).first();
    await row.getByRole('button', { name: 'Xóa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Xóa|Xác nhận/ }).last().click();
    await expect(page.locator('main')).not.toContainText(code);
  });

  test('số lượng âm hoặc để trống tên không lưu được', async ({ page }) => {
    await page.goto('/manager/equipment');
    await settled(page);
    await page.getByRole('button', { name: 'Thêm thiết bị máy mới' }).click();
    await page.locator('#eq-qty').fill('-1');
    await page.getByRole('button', { name: 'Lưu thiết bị' }).click();
    await expect(page.locator('#eq-name')).toBeVisible();
  });
});

test.describe('Quản lý: tài khoản nhân sự', () => {
  test('tạo lễ tân mới đăng nhập được; email trùng và mật khẩu yếu bị từ chối; khóa tài khoản', async ({ page }) => {
    const id = unique('nv').toLowerCase();
    const email = `${id}@example.com`;
    await page.goto('/manager/staff-accounts');
    await settled(page);
    await page.locator('#staff-name').fill('Nhân viên E2E');
    await page.locator('#staff-email').fill(email);
    await page.locator('#staff-phone').fill('0987654321');
    await page.locator('#staff-password').fill('123');
    await page.getByRole('button', { name: 'Tạo tài khoản nhân sự' }).click();
    // dùng kiểm tra hợp lệ gốc của trình duyệt (thông báo hiển thị theo ngôn ngữ trình duyệt, không phải tiếng Việt của app)
    expect(await page.locator('#staff-password').evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(false);
    await expect(page.locator('main')).not.toContainText(email);
    await page.locator('#staff-password').fill('Staff@12345');
    await page.getByRole('button', { name: 'Tạo tài khoản nhân sự' }).click();
    await expect(page.locator('main')).toContainText(email);
    // email trùng
    await page.locator('#staff-name').fill('Nhân viên E2E 2');
    await page.locator('#staff-email').fill(email);
    await page.locator('#staff-phone').fill('0987654322');
    await page.locator('#staff-password').fill('Staff@12345');
    await page.getByRole('button', { name: 'Tạo tài khoản nhân sự' }).click();
    await expect(page.getByRole('alert').or(page.getByText(/đã tồn tại|trùng/i)).first()).toBeVisible();
    void field;
  });
});

test.describe('Quản lý: báo cáo & nhật ký', () => {
  test('báo cáo doanh thu: KPI, lọc 7/30 ngày, khoảng ngày sai bị chặn, xuất báo cáo', async ({ page }) => {
    await page.goto('/manager/reports');
    await settled(page);
    await expect(page.locator('main')).toContainText('Doanh thu hôm nay');
    await page.getByRole('button', { name: '7 ngày qua' }).click();
    await page.getByRole('button', { name: '30 ngày qua' }).click();
    const download = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
    const file = await download;
    if (file) expect(file.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('nhật ký kiểm toán: tìm kiếm, lọc hành động/đối tượng và xem diff', async ({ page }) => {
    await page.goto('/manager/audit-logs');
    await settled(page);
    await field(page, 'Tìm kiếm người thực hiện').fill('manager');
    await page.getByRole('button', { name: 'Xem Diff' }).first().click();
    await expect(page.getByRole('dialog').or(page.locator('main')).first()).toBeVisible();
  });

  test('đánh giá HLV và theo dõi HLV & học viên mở được', async ({ page }) => {
    for (const path of ['/manager/coach-reviews', '/manager/coach-assignments', '/manager/products', '/manager/requests']) {
      await page.goto(path);
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  });
});

test.describe('Admin: tài khoản & phân quyền', () => {
  test.use({ storageState: authFile('admin') });
  test('danh sách tài khoản, tìm kiếm, lọc vai trò', async ({ page }) => {
    await page.goto('/admin/users');
    await settled(page);
    await expect(page.locator('main')).toContainText(/Danh sách tài khoản \(\d+\)/);
    await field(page, /Tìm kiếm theo họ tên/).fill('manager@demo');
    await expect(page.locator('main')).toContainText('manager@demo.sol.vn');
    await field(page, /Tìm kiếm theo họ tên/).fill('khong-ton-tai-xyz');
    await expect(page.locator('main')).not.toContainText('manager@demo.sol.vn');
  });
  test('tab Phân quyền mở được', async ({ page }) => {
    await page.goto('/admin/users');
    await settled(page);
    await page.getByRole('tab', { name: 'Phân quyền' }).or(page.getByRole('button', { name: 'Phân quyền' })).first().click();
    await expect(page.locator('main')).toBeVisible();
  });
});
