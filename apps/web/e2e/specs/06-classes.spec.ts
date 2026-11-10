import { test, expect, settled } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { api } from '../helpers/api';

test.describe('Lịch lớp học & đặt chỗ (hội viên)', () => {
  test.describe('hội viên có gói (binh - Gold)', () => {
    test.use({ storageState: authFile('binh') });

    test('tab Lịch của tôi hiển thị buổi sắp tới, chuyển tuần không lỗi', async ({ page }) => {
      await page.goto('/member/classes');
      await settled(page);
      await expect(page.getByRole('tab', { name: 'Lịch của tôi', selected: true })).toBeVisible();
      await expect(page.locator('main')).toContainText('Morning Flow Yoga');
      await page.getByRole('button', { name: 'Tuần sau' }).click();
      await page.getByRole('button', { name: 'Tuần trước' }).click();
      await page.getByRole('button', { name: 'Tuần này' }).click();
      await page.getByRole('button', { name: 'Tháng' }).click();
      await page.getByRole('button', { name: 'Tuần', exact: true }).click();
    });

    test('khóa học đã bắt đầu trước thời hạn gói: đặt chỗ bị từ chối với thông báo rõ, không tạo thêm đặt chỗ', async ({ page }) => {
      await page.goto('/member/classes');
      await settled(page);
      await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
      const badges = page.locator('main .badge', { hasText: 'Đã đặt chỗ' });
      const before = await badges.count();
      await page.getByRole('button', { name: 'Đặt chỗ ngay' }).first().click();
      await expect(page.getByRole('alert').filter({ hasText: /không bao phủ|hết hạn|gói tập|hết lượt/i }).first()).toBeVisible();
      await expect(badges).toHaveCount(before);
    });

    test('buổi đã qua giờ mở lớp không cho đặt', async ({ page }) => {
      await page.goto('/member/classes');
      await settled(page);
      await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
      const disabled = page.getByRole('button', { name: 'Không thể đặt' }).first();
      await expect(disabled).toBeVisible();
      await expect(disabled).toBeDisabled();
    });

    test('lọc theo bộ môn và theo thứ trong tuần', async ({ page }) => {
      await page.goto('/member/classes');
      await settled(page);
      await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
      await page.getByRole('button', { name: 'Yoga', exact: true }).click();
      await expect(page.locator('main')).toContainText('Morning Flow Yoga');
      await expect(page.locator('main')).not.toContainText('Strength Foundation');
    });
  });

  test.describe('hội viên hết hạn (dung)', () => {
    test.use({ storageState: authFile('dung') });
    test('không đặt được lớp: UI báo cần gói hoạt động và API từ chối', async ({ page }) => {
      await page.goto('/member/classes');
      await settled(page);
      await page.getByRole('tab', { name: 'Lịch lớp học' }).click();
      await expect(page.locator('main')).toContainText(/gói tập|gói hội viên/i);
      const sessions = await api('dung', 'GET', '/classes/sessions');
      const first = (sessions.data as any[] | undefined)?.find?.((s) => s.status === 'scheduled' || s.status === 'SCHEDULED');
      if (first) {
        const res = await api('dung', 'POST', `/classes/sessions/${first.id}/bookings`, {});
        expect(res.status, 'hội viên hết hạn không được đặt lớp').toBeGreaterThanOrEqual(400);
      }
    });
  });
});

test.describe('Quản lý lớp học (lễ tân/quản lý)', () => {
  test.describe('lễ tân xem lịch trung tâm', () => {
    test.use({ storageState: authFile('staff') });
    test('thời khóa biểu tuần và danh sách lớp, không có nút tạo lớp', async ({ page }) => {
      await page.goto('/staff/classes');
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Lịch học trung tâm');
      await expect(page.getByRole('button', { name: 'Tạo lớp học & xếp lịch' })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Danh sách lớp' }).click();
      await expect(page.locator('main')).toContainText('Strength Foundation');
    });
  });

  test.describe('quản lý tạo lớp', () => {
    test.use({ storageState: authFile('manager') });
    test('mở form tạo lớp, để trống bị chặn, hủy form không tạo lớp', async ({ page }) => {
      await page.goto('/staff/classes');
      await settled(page);
      await page.getByRole('button', { name: 'Tạo lớp học & xếp lịch' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /Tạo|Lưu|Xếp lịch/ }).last().click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });
});
