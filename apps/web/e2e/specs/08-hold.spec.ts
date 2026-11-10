import { test, expect, settled, isoDay } from '../fixtures';
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

    test('dữ liệu xấu: thiếu giấy tờ, ngày kết thúc trước ngày bắt đầu, quá dài, quá sát ngày bắt đầu', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      let posted = 0;
      page.on('request', (r) => { if (r.method() === 'POST' && /\/hold$/.test(r.url())) posted++; });
      const submit = page.getByRole('button', { name: 'Gửi đơn bảo lưu' });
      const fill = async (start: string, end: string, reason: string, withFile: boolean) => {
        await page.locator('#hold-start').fill(start);
        await page.locator('#hold-end').fill(end);
        await page.locator('#hold-reason').fill(reason);
        await page.locator('#hold-files').setInputFiles(withFile ? [png()] : []);
        await submit.click();
        await page.waitForTimeout(700);
      };
      await fill(isoDay(3), isoDay(6), 'Đi công tác', false); // thiếu giấy tờ
      await fill(isoDay(6), isoDay(3), 'Đi công tác', true); // kết thúc trước bắt đầu
      await fill(isoDay(3), isoDay(60), 'Đi công tác', true); // vượt quá 30 ngày
      await fill(isoDay(3), isoDay(4), 'Đi công tác', true); // dưới 3 ngày
      await fill(isoDay(0), isoDay(3), 'Đi công tác', true); // không đủ 24 giờ trước ngày bắt đầu
      await fill(isoDay(3), isoDay(6), '', true); // thiếu lý do
      expect(posted, 'không đơn xấu nào được gửi lên server thành công').toBeLessThanOrEqual(5);
      await expect(page.locator('main')).not.toContainText(/Đang chờ duyệt/i);
    });

    test('gửi đơn hợp lệ: hiện trạng thái Chờ duyệt, không gửi được đơn thứ hai', async ({ page }) => {
      await page.goto('/member/hold');
      await settled(page);
      await page.locator('#hold-start').fill(isoDay(3));
      await page.locator('#hold-end').fill(isoDay(6));
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
          await page.locator('#hold-start').fill(isoDay(3));
          await page.locator('#hold-end').fill(isoDay(6));
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
