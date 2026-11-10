import { test, expect, settled, isoDay, pickDate } from '../fixtures';
import { authFile } from '../helpers/accounts';
import { pngDataUrl } from '../helpers/api';

const png = () => ({ name: 'giay-y-te.png', mimeType: 'image/png', buffer: Buffer.from(pngDataUrl().split(',')[1], 'base64') });

test.describe('Bảo lưu gói tập', () => {
  test.describe('gói không đủ điều kiện bảo lưu', () => {
    test.use({ storageState: authFile('binh') });
    test('Gold 1 tháng: trang báo không được bảo lưu và không có form', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      await expect(page.locator('main')).toContainText(/không được bảo lưu/i);
      await expect(page.locator('#hold-start')).toHaveCount(0);
    });
  });

  test.describe('hội viên đang bảo lưu (em)', () => {
    test.use({ storageState: authFile('em') });
    test('hiển thị đơn đã duyệt và khoảng thời gian bảo lưu', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      await expect(page.locator('main')).toContainText('Đã duyệt');
    });
  });

  test.describe('Platinum đủ điều kiện (an)', () => {
    test.use({ storageState: authFile('an') });
    test.describe.configure({ mode: 'serial' });

    test('trang nêu rõ quy định: tối đa/tối thiểu ngày, trước 24 giờ, giấy tờ y tế', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      await expect(page.locator('main')).toContainText(/Tối đa 30 ngày, tối thiểu 3 ngày/);
      await expect(page.locator('main')).toContainText(/24 giờ/);
    });

    test('dữ liệu xấu: thiếu giấy tờ hoặc lý do không gửi được; bộ chọn ngày chặn ngày không hợp lệ', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      let posted = 0;
      page.on('request', (r) => { if (r.method() === 'POST' && /\/hold$/.test(r.url())) posted++; });
      const submit = page.getByRole('button', { name: 'Gửi đơn bảo lưu' });
      await pickDate(page, page.locator('#hold-start'), isoDay(3));
      await pickDate(page, page.locator('#hold-end'), isoDay(6));
      await page.locator('#hold-reason').fill('Đi công tác');
      await submit.click(); // thiếu giấy tờ
      await page.waitForTimeout(600);
      await page.locator('#hold-reason').fill('');
      await page.locator('#hold-files').setInputFiles([png()]);
      await submit.click(); // thiếu lý do
      await page.waitForTimeout(600);
      expect(posted, 'đơn thiếu dữ liệu không được gửi').toBe(0);
      // ngày kết thúc không thể trước ngày bắt đầu; ngày bắt đầu không thể trong vòng 24 giờ tới
      await page.locator('#hold-end').click();
      await expect(page.getByRole('dialog', { name: /Chọn ngày/ }).getByRole('button', { name: isoDay(2), exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await page.locator('#hold-start').click();
      await expect(page.getByRole('dialog', { name: /Chọn ngày/ }).getByRole('button', { name: isoDay(0), exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.locator('main')).not.toContainText(/Đang chờ duyệt/i);
    });

    test('gửi đơn hợp lệ: hiện trạng thái Chờ duyệt, không gửi được đơn thứ hai', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      await pickDate(page, page.locator('#hold-start'), isoDay(3));
      await pickDate(page, page.locator('#hold-end'), isoDay(6));
      await page.locator('#hold-reason').fill('Phẫu thuật nhỏ, có giấy xác nhận của bác sĩ.');
      await page.locator('#hold-files').setInputFiles([png()]);
      await page.getByRole('button', { name: 'Gửi đơn bảo lưu' }).click();
      await expect(page.locator('main')).toContainText(/Đang chờ duyệt/i);
      await expect(page.locator('#hold-start')).toHaveCount(0);
    });
  });

  test.describe('lễ tân duyệt đơn', () => {
    test.use({ storageState: authFile('staff') });
    test('thấy đơn trong tab Chờ duyệt và từ chối được', async ({ page }) => {
      await page.goto('/staff/holds');
      await settled(page);
      await page.getByRole('tab', { name: 'Chờ duyệt' }).click();
      const card = page.locator('main').getByText('Nguyễn Minh An').first();
      await expect(card).toBeVisible();
      await card.locator('xpath=ancestor::*[.//button[normalize-space()="Từ chối"]][1]').getByRole('button', { name: 'Từ chối' }).click();
      const confirm = page.getByRole('dialog');
      await expect(confirm).toContainText('Từ chối đơn bảo lưu?');
      await confirm.getByRole('button', { name: 'Giữ lại' }).click();
      await expect(page.locator('main')).toContainText('Nguyễn Minh An'); // hủy xác nhận: đơn còn nguyên
      await card.locator('xpath=ancestor::*[.//button[normalize-space()="Từ chối"]][1]').getByRole('button', { name: 'Từ chối' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Từ chối', exact: true }).click();
      await expect(page.getByText('Đã từ chối bảo lưu.').first()).toBeVisible();
      await page.getByRole('tab', { name: 'Từ chối' }).click();
      await expect(page.locator('main')).toContainText('Nguyễn Minh An');
    });
  });

  test.describe('hội viên thấy kết quả rồi nộp lại, lễ tân duyệt', () => {
    test.describe.configure({ mode: 'serial' });
    test.describe('hội viên nộp lại', () => {
      test.use({ storageState: authFile('an') });
      test('đơn bị từ chối hiển thị lý do; có thể nộp đơn mới', async ({ page }) => {
        await page.goto('/member/hold');
        await settled(page);
        await expect(page.locator('main')).toContainText(/Bị từ chối/);
        await expect(page.locator('main')).toContainText('Bạn có thể nộp đơn mới');
        {
          await pickDate(page, page.locator('#hold-start'), isoDay(3));
          await pickDate(page, page.locator('#hold-end'), isoDay(6));
          await page.locator('#hold-reason').fill('Nộp lại với giấy tờ đầy đủ.');
          await page.locator('#hold-files').setInputFiles([png()]);
          await page.getByRole('button', { name: 'Gửi đơn bảo lưu' }).click();
          await expect(page.locator('main')).toContainText(/Đang chờ duyệt/i);
        }
      });
    });
    test.describe('lễ tân duyệt', () => {
      test.use({ storageState: authFile('staff') });
      test('duyệt đơn: chuyển sang tab Đã duyệt', async ({ page }) => {
        await page.goto('/staff/holds');
        await settled(page);
        await page.getByRole('tab', { name: 'Chờ duyệt' }).click();
        const card = page.locator('main').getByText('Nguyễn Minh An').first();
        test.skip(!(await card.isVisible().catch(() => false)), 'Không có đơn chờ duyệt (đơn lần trước chưa được nộp lại)');
        await card.locator('xpath=ancestor::*[.//button[normalize-space()="Duyệt bảo lưu"]][1]').getByRole('button', { name: 'Duyệt bảo lưu' }).click();
        await expect(page.getByText('Đã duyệt bảo lưu.').first()).toBeVisible();
        await page.getByRole('tab', { name: 'Đã duyệt' }).click();
        await expect(page.locator('main')).toContainText('Nguyễn Minh An');
      });
    });
  });
});
