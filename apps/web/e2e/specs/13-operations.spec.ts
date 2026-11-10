import { test, expect, settled, pickDate, isoDay } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { unique } from '../helpers/api';

test.describe('Đơn từ nội bộ (HLV/lễ tân -> quản lý)', () => {
  test.describe.configure({ mode: 'serial' });
  const approveTitle = `E2E nghỉ phép ${unique('a')}`;
  const rejectTitle = `E2E đổi ca ${unique('r')}`;

  test.describe('HLV gửi đơn', () => {
    test.use({ storageState: authFile('coach') });

    test('gửi đơn nghỉ phép hợp lệ xuất hiện ở tab Chờ duyệt', async ({ page }) => {
      await page.goto('/staff/requests');
      await settled(page);
      await page.getByRole('button', { name: /Tạo đơn từ mới/ }).click();
      await page.locator('#internal-request-title').fill(approveTitle);
      await pickDate(page, page.locator('#internal-request-start'), isoDay(10));
      await pickDate(page, page.locator('#internal-request-end'), isoDay(11));
      await page.locator('#internal-request-reason').fill('Việc gia đình, đã bàn giao lớp.');
      await page.getByRole('button', { name: 'Gửi đơn tới Quản Lý' }).click();
      await page.getByRole('button', { name: 'Chờ duyệt' }).click();
      await expect(page.locator('main')).toContainText(approveTitle);
    });

    test('đơn thứ hai (đổi ca) để quản lý từ chối', async ({ page }) => {
      await page.goto('/staff/requests');
      await settled(page);
      await page.getByRole('button', { name: /Tạo đơn từ mới/ }).click();
      await page.locator('#internal-request-type').click();
      await page.getByRole('option', { name: /Đề xuất công việc/ }).click();
      await page.locator('#internal-request-title').fill(rejectTitle);
      await page.locator('#internal-request-reason').fill('Đề xuất đổi ca sáng sang ca tối.');
      await page.getByRole('button', { name: 'Gửi đơn tới Quản Lý' }).click();
      await page.getByRole('button', { name: 'Chờ duyệt' }).click();
      await expect(page.locator('main')).toContainText(rejectTitle);
    });

    test('dữ liệu xấu: đơn nghỉ phép thiếu ngày kết thúc không gửi được', async ({ page }) => {
      await page.goto('/staff/requests');
      await settled(page);
      let posted = 0;
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/operations/requests')) posted++; });
      await page.getByRole('button', { name: /Tạo đơn từ mới/ }).click();
      await page.getByRole('button', { name: 'Gửi đơn tới Quản Lý' }).click();
      await page.waitForTimeout(600);
      await page.locator('#internal-request-title').fill('x');
      await pickDate(page, page.locator('#internal-request-start'), isoDay(12));
      // bộ chọn ngày không cho chọn ngày kết thúc trước ngày bắt đầu
      await page.locator('#internal-request-end').click();
      await expect(page.getByRole('dialog', { name: /Chọn ngày/ }).getByRole('button', { name: isoDay(11), exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await page.locator('#internal-request-reason').fill('lý do');
      await page.getByRole('button', { name: 'Gửi đơn tới Quản Lý' }).click();
      await page.waitForTimeout(800);
      expect(posted, 'đơn sai không được tạo').toBe(0);
    });
  });

  test.describe('Quản lý duyệt', () => {
    test.use({ storageState: authFile('manager') });
    test('thấy cả hai đơn, duyệt đơn nghỉ phép và từ chối đơn còn lại', async ({ page }) => {
      await page.goto('/manager/requests');
      await settled(page);
      await page.getByRole('button', { name: 'Chờ duyệt' }).click();
      const approve = page.locator('article, li, tr, div').filter({ hasText: approveTitle }).filter({ has: page.getByRole('button', { name: /Duyệt|Phê duyệt/ }) }).last();
      await approve.getByRole('button', { name: /^(Phê )?[Dd]uyệt/ }).first().click();
      const dlg = page.getByRole('dialog');
      if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: /Duyệt|Xác nhận/ }).last().click();
      await expect(page.locator('main')).not.toContainText(approveTitle);
      const reject = page.locator('article, li, tr, div').filter({ hasText: rejectTitle }).filter({ has: page.getByRole('button', { name: /Từ chối/ }) }).last();
      await reject.getByRole('button', { name: /Từ chối/ }).first().click();
      const dlg2 = page.getByRole('dialog');
      await expect(dlg2).toBeVisible();
      await dlg2.locator('textarea').fill('Trùng lịch sự kiện, chưa có người thay thế.');
      await dlg2.getByRole('button', { name: /Từ chối|Xác nhận/ }).last().click();
      await expect(page.locator('main')).not.toContainText(rejectTitle);
    });
  });

  test.describe('HLV thấy kết quả', () => {
    test.use({ storageState: authFile('coach') });
    test('đơn được duyệt ở tab Đã duyệt; đơn bị từ chối kèm lý do', async ({ page }) => {
      await page.goto('/staff/requests');
      await settled(page);
      await page.getByRole('button', { name: 'Đã duyệt' }).click();
      await expect(page.locator('main')).toContainText(approveTitle);
      await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
      await expect(page.locator('main')).toContainText(rejectTitle);
      await expect(page.locator('main')).toContainText(/Trùng lịch sự kiện/);
    });
  });
});

test.describe('Đơn từ: kiểm tra API', () => {
  test('ngày kết thúc trước ngày bắt đầu bị 400 với thông báo tiếng Việt, không lộ khóa i18n', async () => {
    const { api } = await import('../helpers/api');
    const res = await api('coach', 'POST', '/operations/requests', { requestType: 'LEAVE', title: 'e2e', reason: 'e2e', startDate: '2026-12-22', endDate: '2026-12-21' });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).not.toMatch(/^error\./);
  });
  test('thiếu tiêu đề và lý do bị 400 có chi tiết từng trường', async () => {
    const { api } = await import('../helpers/api');
    const res = await api('coach', 'POST', '/operations/requests', { requestType: 'LEAVE', title: '', reason: '' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('title');
    expect(res.body.details).toHaveProperty('reason');
  });
});

test.describe('Thông báo và tin nhắn', () => {
  test.use({ storageState: authFile('binh') });
  test('khung thông báo mở được từ chuông; tin nhắn mở được trang /messages', async ({ page }) => {
    await page.goto('/member/dashboard');
    await settled(page);
    await page.getByRole('button', { name: /Thông báo/ }).click();
    await expect(page.getByRole('dialog').or(page.getByRole('region', { name: /Thông báo/ })).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/messages');
    await settled(page);
    await expect(page.locator('main')).toContainText('Tin nhắn');
    await expect(page.locator('main')).toContainText(/SÖL AI/);
  });
});
